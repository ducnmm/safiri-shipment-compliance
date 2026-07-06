import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rule 9 — arrival within the operational review window. If the arrival date is
 * strictly older than (now - REVIEW_WINDOW_DAYS), the shipment has likely
 * already arrived and is accruing demurrage, so it should be prioritised. Uses
 * the injected `ctx.now` so the rule is deterministic and testable.
 */
export const arrivalWindowRule: Rule = {
  code: 'ARRIVAL_WINDOW',
  description: 'Arrival date must fall within the operational review window.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    if (shipment.arrivalDate === null) return []; // missing date handled by rule 1
    const cutoff = new Date(ctx.now.getTime() - ctx.config.REVIEW_WINDOW_DAYS * MS_PER_DAY);
    if (shipment.arrivalDate.getTime() >= cutoff.getTime()) return [];

    const daysAgo = Math.floor((ctx.now.getTime() - shipment.arrivalDate.getTime()) / MS_PER_DAY);
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
