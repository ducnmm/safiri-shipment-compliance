import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { valuesEqual } from '../util.js';

/**
 * Rule 11 — document/shipment mismatch. For each ingested document and each
 * comparable field, if both the document and the shipment have a value and they
 * disagree, raise an issue. This is the payoff of keeping documents separate
 * from the canonical shipment (fill-if-missing never overwrites, so conflicts
 * survive to be caught here). Invoice-value mismatches are fraud-sensitive and
 * escalated to HIGH.
 */
export const documentMismatchRule: Rule = {
  code: 'DOCUMENT_MISMATCH',
  description: 'Document values must agree with the canonical shipment record.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    const issues: IssueDraft[] = [];
    const shipmentRecord = shipment as unknown as Record<string, unknown>;

    for (const doc of ctx.documents) {
      for (const field of ctx.config.MISMATCH_FIELDS) {
        const docValue = doc.mappedFields[field];
        const shipValue = shipmentRecord[field];
        if (docValue === null || docValue === undefined) continue;
        if (shipValue === null || shipValue === undefined) continue;
        if (valuesEqual(shipValue, docValue)) continue;

        issues.push({
          ruleCode: 'DOCUMENT_SHIPMENT_MISMATCH',
          issueType: 'document_shipment_mismatch',
          severity: field === 'invoiceValue' ? 'high' : 'medium',
          field,
          explanation: `Field "${field}" differs between the shipment record (${format(shipValue)}) and document ${doc.id} (${format(docValue)}).`,
          suggestedAction: `Reconcile the shipment record with document ${doc.id}.`,
        });
      }
    }

    return issues;
  },
};

function format(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
