import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

/**
 * Rule 7 — invoice value sanity.
 *  - A non-positive value is a hard data error (HIGH).
 *  - Otherwise, if gross weight is known, the value-per-kg is checked against a
 *    plausibility band; falling outside it is a soft flag (MEDIUM) that can
 *    indicate under- or over-invoicing.
 *
 * The value is normalised to USD first (via the snapshot FX rates in the
 * context) so the band is currency-agnostic: 1.2 billion VND and 48k USD for the
 * same cargo no longer look wildly different. If the currency is missing or has
 * no FX rate we skip the plausibility check rather than compare raw numbers —
 * the currency problem itself is surfaced by rules 1 and 3. The band is a coarse
 * heuristic; a production build would use HS×route unit-value percentiles
 * (e.g. UN Comtrade) instead of a fixed band. See README.
 */
export const invoiceValueRule: Rule = {
  code: 'INVOICE_VALUE',
  description: 'Invoice value must be positive and plausible for the weight.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    const { invoiceValue: value, grossWeightKg: gross, currency } = shipment;
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
      const rate = currency ? ctx.fxRatesUsd[currency.toUpperCase()] : undefined;
      if (rate === undefined) return []; // can't normalise -> don't guess (currency flagged elsewhere)

      const valueUsd = value * rate;
      const perKgUsd = valueUsd / gross;
      const { SUSPICIOUS_MIN_VALUE_PER_KG: min, SUSPICIOUS_MAX_VALUE_PER_KG: max } = ctx.config;
      if (perKgUsd < min || perKgUsd > max) {
        const usdNote =
          currency && currency.toUpperCase() === 'USD'
            ? ''
            : ` (${value} ${currency} ≈ ${valueUsd.toFixed(2)} USD)`;
        return [
          {
            ruleCode: 'INVOICE_VALUE_SUSPICIOUS',
            issueType: 'invoice_value_suspicious',
            severity: 'medium',
            field: 'invoiceValue',
            explanation: `Invoice value implies ${perKgUsd.toFixed(2)} USD/kg over ${gross} kg${usdNote}, outside the plausible band of ${min}–${max} USD/kg. This may indicate under- or over-invoicing.`,
            suggestedAction: 'Confirm the commercial invoice with the exporter and check for under/over-invoicing.',
          },
        ];
      }
    }

    return [];
  },
};
