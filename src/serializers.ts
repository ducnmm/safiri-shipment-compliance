import type { Shipment, ValidationIssue, ValidationRun, AuditLog } from '@prisma/client';

/** Format a Date as a date-only string (arrival dates are day-granular). */
function dateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Shipment -> snake_case API response. */
export function toShipmentResponse(s: Shipment): Record<string, unknown> {
  return {
    id: s.id,
    status: s.status,
    shipment_reference: s.reference,
    exporter: s.exporter,
    importer: s.importer,
    invoice_number: s.invoiceNumber,
    invoice_value: s.invoiceValue,
    currency: s.currency,
    goods_description: s.goodsDescription,
    hs_code: s.hsCode,
    country_of_origin: s.countryOfOrigin,
    gross_weight_kg: s.grossWeightKg,
    net_weight_kg: s.netWeightKg,
    number_of_packages: s.numberOfPackages,
    container_number: s.containerNumber,
    bill_of_lading: s.billOfLading,
    packaging_type: s.packagingType,
    ispm15_certified: s.ispm15Certified,
    arrival_date: dateOnly(s.arrivalDate),
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export interface ShipmentDetailExtras {
  documentCount: number;
  latestRun: { id: string; ranAt: Date; issueCount: number } | null;
}

/** Shipment detail view including document count and latest validation summary. */
export function toShipmentDetailResponse(s: Shipment, extras: ShipmentDetailExtras): Record<string, unknown> {
  return {
    ...toShipmentResponse(s),
    document_count: extras.documentCount,
    latest_validation: extras.latestRun
      ? {
          run_id: extras.latestRun.id,
          ran_at: extras.latestRun.ranAt.toISOString(),
          issue_count: extras.latestRun.issueCount,
        }
      : null,
  };
}

/** ValidationIssue -> snake_case API response. */
export function toIssueResponse(i: ValidationIssue): Record<string, unknown> {
  return {
    rule_code: i.ruleCode,
    issue_type: i.issueType,
    severity: i.severity,
    field: i.field,
    explanation: i.explanation,
    suggested_action: i.suggestedAction,
  };
}

/** AuditLog -> snake_case API response (details parsed back to an object). */
export function toAuditResponse(a: AuditLog): Record<string, unknown> {
  let details: unknown;
  try {
    details = JSON.parse(a.details);
  } catch {
    details = a.details;
  }
  return {
    id: a.id,
    action: a.action,
    actor: a.actor,
    details,
    created_at: a.createdAt.toISOString(),
  };
}

export function toRunResponse(run: ValidationRun, issues: ValidationIssue[]): Record<string, unknown> {
  return {
    run_id: run.id,
    ran_at: run.ranAt.toISOString(),
    issue_count: run.issueCount,
    issues: issues.map(toIssueResponse),
  };
}
