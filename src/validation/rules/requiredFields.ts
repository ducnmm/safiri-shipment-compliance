import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing } from '../util.js';

/** Human-friendly labels for the required fields (for explanations). */
const FIELD_LABELS: Record<string, string> = {
  reference: 'shipment reference',
  exporter: 'exporter',
  importer: 'importer',
  invoiceNumber: 'commercial invoice number',
  invoiceValue: 'invoice value',
  currency: 'currency',
  goodsDescription: 'goods description',
  hsCode: 'HS code',
  grossWeightKg: 'gross weight',
  netWeightKg: 'net weight',
  numberOfPackages: 'number of packages',
  arrivalDate: 'arrival date',
};

/**
 * Rule 1 — flags each configured required field that is missing. One issue per
 * missing field so the ops team gets a precise checklist.
 */
export const requiredFieldsRule: Rule = {
  code: 'REQUIRED_FIELDS',
  description: 'Every required field must be present.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    const issues: IssueDraft[] = [];
    for (const field of ctx.config.REQUIRED_FIELDS) {
      const value = (shipment as unknown as Record<string, unknown>)[field];
      if (isMissing(value)) {
        const label = FIELD_LABELS[field] ?? field;
        issues.push({
          ruleCode: 'MISSING_REQUIRED_FIELD',
          issueType: 'missing_required_field',
          severity: 'high',
          field,
          explanation: `Required field "${label}" is missing.`,
          suggestedAction: `Obtain the ${label} from the shipper's documentation.`,
        });
      }
    }
    return issues;
  },
};
