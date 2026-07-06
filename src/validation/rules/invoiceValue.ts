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
 * same cargo no longer look wildly different. Cases where we can't normalise:
 *   - currency missing/invalid  -> already flagged by rules 1/3, stay quiet here;
 *   - currency is a valid ISO code but not in the FX snapshot -> we can't assess
 *     plausibility, so emit a LOW "unchecked" note (surface it, don't skip
 *     silently) rather than compare raw cross-currency numbers.
 * The band is a coarse heuristic; a production build would use HS×route
 * unit-value percentiles (e.g. UN Comtrade) instead of a fixed band. See README.
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
      const code = currency ? currency.trim().toUpperCase() : null;
      const rate = code ? ctx.fxRatesUsd[code] : undefined;
      if (rate === undefined) {
        // A valid ISO currency we simply lack a snapshot rate for: surface that the
        // plausibility check was skipped (LOW). A missing/invalid currency is
        // already flagged by rules 1/3, so stay quiet there to avoid double-reporting.
        if (code && ctx.currencies.has(code)) {
          return [
            {
              ruleCode: 'INVOICE_VALUE_PLAUSIBILITY_UNCHECKED',
              issueType: 'invoice_plausibility_unchecked',
              severity: 'low',
              field: 'invoiceValue',
              explanation: `Invoice plausibility not assessed: no snapshot FX rate for currency ${code}, so the value could not be normalised to USD for the per-kg check.`,
              suggestedAction: 'Add an FX rate for this currency, or review the invoice value manually.',
            },
          ];
        }
        return [];
      }

      const valueUsd = value * rate;
      const perKgUsd = valueUsd / gross;
      const { SUSPICIOUS_MIN_VALUE_PER_KG: min, SUSPICIOUS_MAX_VALUE_PER_KG: max } = ctx.config;
      if (perKgUsd < min || perKgUsd > max) {
        const usdNote = code === 'USD' ? '' : ` (${value} ${code} ≈ ${valueUsd.toFixed(2)} USD)`;
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
