import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

/**
 * Rule 10 — duplicate shipment reference. The duplicate count (other shipments
 * sharing this reference) is pre-fetched into the context. We surface duplicates
 * as an issue rather than rejecting them at creation, so the ops team can decide
 * which record is canonical (see ARCHITECTURE.md, "triage not reject").
 */
export const duplicateReferenceRule: Rule = {
  code: 'DUPLICATE_REFERENCE',
  description: 'Shipment reference should be unique.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    if (ctx.duplicateReferenceCount <= 0) return [];
    return [
      {
        ruleCode: 'DUPLICATE_SHIPMENT_REFERENCE',
        issueType: 'duplicate_reference',
        severity: 'high',
        field: 'reference',
        explanation: `Shipment reference "${shipment.reference}" is used by ${ctx.duplicateReferenceCount} other shipment record(s).`,
        suggestedAction: 'Merge or archive the duplicate record so a single canonical shipment remains.',
      },
    ];
  },
};
