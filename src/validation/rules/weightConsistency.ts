import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';

/**
 * Rule 4 — weight sanity.
 *  - Any present weight that is <= 0 is flagged (WEIGHT_NON_POSITIVE).
 *  - If both weights are present and gross < net, that is physically impossible
 *    (gross includes packaging) — WEIGHT_INCONSISTENT. Equal weights are allowed.
 */
export const weightConsistencyRule: Rule = {
  code: 'WEIGHT_CONSISTENCY',
  description: 'Weights must be positive and gross must be >= net.',
  check(shipment: ShipmentSnapshot, _ctx: ValidationContext): IssueDraft[] {
    const issues: IssueDraft[] = [];
    const { grossWeightKg: gross, netWeightKg: net } = shipment;

    if (gross !== null && gross <= 0) {
      issues.push(nonPositive('grossWeightKg', 'gross weight', gross));
    }
    if (net !== null && net <= 0) {
      issues.push(nonPositive('netWeightKg', 'net weight', net));
    }

    if (gross !== null && net !== null && gross > 0 && net > 0 && gross < net) {
      issues.push({
        ruleCode: 'WEIGHT_INCONSISTENT',
        issueType: 'weight_inconsistent',
        severity: 'high',
        field: 'grossWeightKg',
        explanation: `Gross weight (${gross} kg) is lower than net weight (${net} kg), which is physically impossible.`,
        suggestedAction: 'Re-check the weighbridge ticket and packing list; gross must include packaging.',
      });
    }

    return issues;
  },
};

function nonPositive(field: string, label: string, value: number): IssueDraft {
  return {
    ruleCode: 'WEIGHT_NON_POSITIVE',
    issueType: 'weight_non_positive',
    severity: 'high',
    field,
    explanation: `${label[0]?.toUpperCase()}${label.slice(1)} must be greater than zero (got ${value}).`,
    suggestedAction: 'Re-check the weighbridge ticket and packing list.',
  };
}
