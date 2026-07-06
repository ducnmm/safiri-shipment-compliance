import { SEVERITY_RANK, type ShipmentSnapshot } from '../types.js';
import { rules } from './registry.js';
import type { IssueDraft, ValidationContext } from './types.js';

/**
 * Run every registered rule against a shipment and return the flattened issues,
 * sorted by severity (critical first) then rule code for stable output.
 * Pure and synchronous — all IO was pre-fetched into `ctx`.
 */
export function runRules(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
  const issues = rules.flatMap((rule) => rule.check(shipment, ctx));
  return issues.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return bySeverity !== 0 ? bySeverity : a.ruleCode.localeCompare(b.ruleCode);
  });
}
