import type { Tx } from '../db.js';

/** Every audit action string the system emits (see §12 of the plan). */
export const AUDIT_ACTIONS = [
  'shipment.created',
  'document.ingested',
  'shipment.field_updated',
  'validation.run_completed',
  'report.generated',
  'shipment.status_changed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The single choke point for writing audit entries. Everything that mutates a
 * shipment records exactly one row here, in the SAME transaction as the change,
 * so the audit trail can never drift from reality. `details` is serialized to
 * JSON and should carry enough context to reconstruct what happened.
 */
export async function record(
  tx: Tx,
  shipmentId: string,
  action: AuditAction,
  actor: string,
  details: unknown,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      shipmentId,
      action,
      actor,
      details: JSON.stringify(details ?? {}),
    },
  });
}
