import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing } from '../util.js';

/**
 * Rule 5 — Bill of Lading presence. Critical: without a B/L the carrier cannot
 * release the cargo, so a missing B/L is a hard blocker rather than a warning.
 */
export const billOfLadingRule: Rule = {
  code: 'BILL_OF_LADING',
  description: 'A Bill of Lading number is required to release cargo.',
  check(shipment: ShipmentSnapshot, _ctx: ValidationContext): IssueDraft[] {
    if (!isMissing(shipment.billOfLading)) return [];
    return [
      {
        ruleCode: 'MISSING_BILL_OF_LADING',
        issueType: 'missing_bill_of_lading',
        severity: 'critical',
        field: 'billOfLading',
        explanation: 'Bill of Lading number is missing; cargo cannot be released without it.',
        suggestedAction: 'Request the Bill of Lading number from the carrier or freight forwarder.',
      },
    ];
  },
};
