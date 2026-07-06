import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

/**
 * Rule 7 — invoice value sanity.
 *  - A non-positive value is a hard data error (HIGH).
 *  - Otherwise, if gross weight is known, the value-per-kg is checked against a
 *    plausibility band; falling outside it is a soft flag (MEDIUM) that can
 *    indicate under- or over-invoicing. The heuristic is deliberately
 *    currency-naive (documented) — production would normalise to a base currency.
 */
export const invoiceValueRule: Rule = {
  code: 'INVOICE_VALUE',
  description: 'Invoice value must be positive and plausible for the weight.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    const { invoiceValue: value, grossWeightKg: gross } = shipment;
    if (value === null) return []; // missing value handled by rule 1

    if (value <= 0) {
      return [
        {
          ruleCode: 'INVOICE_VALUE_NON_POSITIVE',
          issueType: 'invoice_value_non_positive',
          severity: 'high',
          field: 'invoiceValue',
          explanation: `Invoice value must be greater than zero (got ${value}).`,
          suggestedAction: 'Confirm the commercial invoice value with the exporter.',
        },
      ];
    }

    if (gross !== null && gross > 0) {
      const perKg = value / gross;
      const { SUSPICIOUS_MIN_VALUE_PER_KG: min, SUSPICIOUS_MAX_VALUE_PER_KG: max } = ctx.config;
      if (perKg < min || perKg > max) {
        return [
          {
            ruleCode: 'INVOICE_VALUE_SUSPICIOUS',
            issueType: 'invoice_value_suspicious',
            severity: 'medium',
            field: 'invoiceValue',
            explanation: `Invoice value implies ${perKg.toFixed(2)} per kg (value ${value} over ${gross} kg), outside the plausible band of ${min}–${max} per kg. This may indicate under- or over-invoicing.`,
            suggestedAction: 'Confirm the commercial invoice with the exporter and check for under/over-invoicing.',
          },
        ];
      }
    }

    return [];
  },
};
