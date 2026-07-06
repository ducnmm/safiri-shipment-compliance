import type { Shipment, ValidationIssue, ValidationRun } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { referenceData } from '../reference/referenceData.js';
import { deriveStatus, isTerminal } from '../statusMachine.js';
import type { ShipmentSnapshot, ShipmentStatus } from '../types.js';
import { runRules } from '../validation/engine.js';
import type { DocumentView, IssueDraft } from '../validation/types.js';
import * as audit from './auditService.js';

/**
 * Injectable clock. Production uses the real time; tests can freeze it so
 * date-based rules (e.g. arrival window) are deterministic without threading a
 * timestamp through the HTTP layer.
 */
let clock: () => Date = () => new Date();

/** Test seam: override or reset the clock. */
export function _setClock(fn: (() => Date) | null): void {
  clock = fn ?? (() => new Date());
}

export interface ValidationResult {
  run: ValidationRun;
  issues: IssueDraft[];
  status: ShipmentStatus;
  previousStatus: ShipmentStatus;
  statusChanged: boolean;
}

/**
 * Run the validation engine against a shipment and persist the run, its issues,
 * the derived status, and the audit events — all in one transaction.
 */
export async function validate(
  shipmentId: string,
  actor: string,
  options: { now?: Date } = {},
): Promise<ValidationResult> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  const previousStatus = shipment.status as ShipmentStatus;
  if (isTerminal(previousStatus)) {
    throw AppError.invalidState(
      `Shipment is ${previousStatus} (terminal) and cannot be re-validated.`,
    );
  }

  const now = options.now ?? clock();
  const [duplicateReferenceCount, documents] = await Promise.all([
    prisma.shipment.count({ where: { reference: shipment.reference, id: { not: shipmentId } } }),
    prisma.document.findMany({ where: { shipmentId }, orderBy: { createdAt: 'asc' } }),
  ]);

  const documentViews: DocumentView[] = documents.map((doc) => ({
    id: doc.id,
    mappedFields: parseMappedFields(doc.mappedFields),
  }));

  const snapshot = toSnapshot(shipment);
  const issues = runRules(snapshot, {
    now,
    countries: referenceData.countries,
    currencies: referenceData.currencies,
    hsChapters: referenceData.hsChapters,
    duplicateReferenceCount,
    documents: documentViews,
    config,
  });

  const newStatus = deriveStatus(issues);
  const statusChanged = newStatus !== previousStatus;

  const run = await prisma.$transaction(async (tx) => {
    const createdRun = await tx.validationRun.create({
      data: { shipmentId, issueCount: issues.length },
    });

    if (issues.length > 0) {
      await tx.validationIssue.createMany({
        data: issues.map((issue) => ({ ...issue, runId: createdRun.id })),
      });
    }

    await tx.shipment.update({ where: { id: shipmentId }, data: { status: newStatus } });

    const bySeverity = countBySeverity(issues);
    await audit.record(tx, shipmentId, 'validation.run_completed', actor, {
      runId: createdRun.id,
      issueCount: issues.length,
      bySeverity,
    });

    if (statusChanged) {
      await audit.record(tx, shipmentId, 'shipment.status_changed', actor, {
        from: previousStatus,
        to: newStatus,
        trigger: 'validation',
      });
    }

    return createdRun;
  });

  return { run, issues, status: newStatus, previousStatus, statusChanged };
}

export interface IssuesView {
  run: ValidationRun;
  issues: ValidationIssue[];
}

/** Fetch the issues for the latest validation run (or a specific run via runId). */
export async function getIssues(shipmentId: string, runId?: string): Promise<IssuesView> {
  // Ensure the shipment exists (distinguish 404 from 409).
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  const run = runId
    ? await prisma.validationRun.findFirst({ where: { id: runId, shipmentId } })
    : await prisma.validationRun.findFirst({ where: { shipmentId }, orderBy: { ranAt: 'desc' } });

  if (!run) {
    throw AppError.invalidState('Shipment has not been validated yet; run POST /validate first.');
  }

  const issues = await prisma.validationIssue.findMany({ where: { runId: run.id } });
  return { run, issues: sortIssues(issues) };
}

/** Map a persisted shipment to the plain snapshot the rules operate on. */
function toSnapshot(shipment: Shipment): ShipmentSnapshot {
  return {
    id: shipment.id,
    reference: shipment.reference,
    exporter: shipment.exporter,
    importer: shipment.importer,
    invoiceNumber: shipment.invoiceNumber,
    invoiceValue: shipment.invoiceValue,
    currency: shipment.currency,
    goodsDescription: shipment.goodsDescription,
    hsCode: shipment.hsCode,
    countryOfOrigin: shipment.countryOfOrigin,
    grossWeightKg: shipment.grossWeightKg,
    netWeightKg: shipment.netWeightKg,
    numberOfPackages: shipment.numberOfPackages,
    containerNumber: shipment.containerNumber,
    billOfLading: shipment.billOfLading,
    packagingType: shipment.packagingType,
    ispm15Certified: shipment.ispm15Certified,
    arrivalDate: shipment.arrivalDate,
    status: shipment.status as ShipmentStatus,
  };
}

function parseMappedFields(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function countBySeverity(issues: IssueDraft[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }
  return counts;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    const bySeverity = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
    return bySeverity !== 0 ? bySeverity : a.ruleCode.localeCompare(b.ruleCode);
  });
}
