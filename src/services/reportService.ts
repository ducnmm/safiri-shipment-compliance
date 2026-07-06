import type { Shipment, ValidationIssue, ValidationRun } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import * as audit from './auditService.js';

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface IssueView {
  rule_code: string;
  severity: string;
  field: string | null;
  explanation: string;
  suggested_action: string;
}

/**
 * Build the readiness report — a projection over the latest validation run.
 * The report is computed, not stored (the ValidationRun is the source of truth);
 * generating one records a `report.generated` audit event.
 */
export async function generateReport(
  shipmentId: string,
  actor: string,
): Promise<Record<string, unknown>> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  const run = await prisma.validationRun.findFirst({
    where: { shipmentId },
    orderBy: { ranAt: 'desc' },
  });
  if (!run) {
    throw AppError.invalidState('Shipment has not been validated yet; run POST /validate first.');
  }

  const issues = await prisma.validationIssue.findMany({ where: { runId: run.id } });
  const report = buildReport(shipment, run, issues);

  await prisma.$transaction(async (tx) => {
    await audit.record(tx, shipmentId, 'report.generated', actor, {
      runId: run.id,
      totalIssues: issues.length,
    });
  });

  return report;
}

function buildReport(
  shipment: Shipment,
  run: ValidationRun,
  issues: ValidationIssue[],
): Record<string, unknown> {
  const sorted = [...issues].sort(
    (a, b) =>
      (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0) ||
      a.ruleCode.localeCompare(b.ruleCode),
  );

  const view = (i: ValidationIssue): IssueView => ({
    rule_code: i.ruleCode,
    severity: i.severity,
    field: i.field,
    explanation: i.explanation,
    suggested_action: i.suggestedAction,
  });

  const blockers = sorted.filter((i) => i.severity === 'critical').map(view);
  const warnings = sorted.filter((i) => i.severity === 'high' || i.severity === 'medium').map(view);
  const info = sorted.filter((i) => i.severity === 'low').map(view);

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of issues) {
    if (i.severity in bySeverity) {
      bySeverity[i.severity as keyof typeof bySeverity] += 1;
    }
  }

  const humanReviewRequired =
    bySeverity.critical > 0 ||
    bySeverity.high > 0 ||
    issues.some((i) => i.ruleCode === 'INVOICE_VALUE_SUSPICIOUS');

  return {
    shipment_reference: shipment.reference,
    summary: {
      exporter: shipment.exporter,
      importer: shipment.importer,
      goods_description: shipment.goodsDescription,
      invoice: formatInvoice(shipment),
      route: formatRoute(shipment),
      arrival_date: shipment.arrivalDate ? shipment.arrivalDate.toISOString().slice(0, 10) : null,
    },
    current_status: shipment.status,
    validation: {
      run_id: run.id,
      ran_at: run.ranAt.toISOString(),
      total_issues: issues.length,
    },
    issues_by_severity: bySeverity,
    critical_blockers: blockers,
    warnings,
    info,
    human_review_required: humanReviewRequired,
    suggested_next_actions: buildNextActions(sorted, blockers.length),
  };
}

function formatInvoice(shipment: Shipment): string | null {
  if (shipment.invoiceValue === null) return null;
  return shipment.currency
    ? `${shipment.invoiceValue} ${shipment.currency}`
    : `${shipment.invoiceValue}`;
}

function formatRoute(shipment: Shipment): string {
  const origin = shipment.countryOfOrigin ?? 'unknown origin';
  return `${origin} → destination (not captured)`;
}

function buildNextActions(sortedIssues: ValidationIssue[], blockerCount: number): string[] {
  if (sortedIssues.length === 0) {
    return ['Proceed to customs submission.'];
  }
  // Deduplicate suggested actions, preserving the severity-sorted order (blockers first).
  const actions: string[] = [];
  for (const issue of sortedIssues) {
    if (!actions.includes(issue.suggestedAction)) {
      actions.push(issue.suggestedAction);
    }
  }
  const top = actions.slice(0, 5);
  if (blockerCount > 0) {
    top.push('Resolve critical blockers and re-run validation.');
  }
  return top;
}
