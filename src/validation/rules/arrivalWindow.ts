import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rule 9 — arrival date plausibility, on both sides of "now":
 *   - strictly older than (now - REVIEW_WINDOW_DAYS): the shipment has likely
 *     already arrived and is accruing demurrage, so it should be prioritised;
 *   - more than MAX_FUTURE_ARRIVAL_DAYS in the future: implausible for ocean
 *     freight and almost certainly a data-entry / OCR error (a year misread as
 *     2062, say) — flag it so a bad date cannot quietly derive the shipment to
 *     `ready`.
 * Uses the injected `ctx.now` so the rule is deterministic and testable.
 */
export const arrivalWindowRule: Rule = {
  code: 'ARRIVAL_WINDOW',
  description: 'Arrival date must be within the review window and not implausibly far in the future.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    if (shipment.arrivalDate === null) return []; // missing date handled by rule 1
    const arrival = shipment.arrivalDate.getTime();

    const futureCutoff = ctx.now.getTime() + ctx.config.MAX_FUTURE_ARRIVAL_DAYS * MS_PER_DAY;
    if (arrival > futureCutoff) {
      const daysAhead = Math.floor((arrival - ctx.now.getTime()) / MS_PER_DAY);
      return [
        {
          ruleCode: 'ARRIVAL_DATE_IMPLAUSIBLE_FUTURE',
          issueType: 'arrival_implausible_future',
          severity: 'medium',
          field: 'arrivalDate',
          explanation: `Arrival date is ${daysAhead} days in the future, beyond the ${ctx.config.MAX_FUTURE_ARRIVAL_DAYS}-day plausibility window for ocean freight. This is almost certainly a data-entry or OCR error.`,
          suggestedAction: 'Verify the arrival date against the carrier schedule / Bill of Lading.',
        },
      ];
    }

    const cutoff = ctx.now.getTime() - ctx.config.REVIEW_WINDOW_DAYS * MS_PER_DAY;
    if (arrival >= cutoff) return [];

    const daysAgo = Math.floor((ctx.now.getTime() - arrival) / MS_PER_DAY);
    return [
      {
        ruleCode: 'ARRIVAL_DATE_OUT_OF_REVIEW_WINDOW',
        issueType: 'arrival_out_of_window',
        severity: 'high',
        field: 'arrivalDate',
        explanation: `Arrival date is ${daysAgo} days ago, older than the ${ctx.config.REVIEW_WINDOW_DAYS}-day review window. The shipment may already have arrived and be accruing demurrage.`,
        suggestedAction: 'Escalate for priority review to avoid demurrage charges.',
      },
    ];
  },
};
