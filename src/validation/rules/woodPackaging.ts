import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing } from '../util.js';

/**
 * Rule 8 — wood packaging requires ISPM-15 certification. If the packaging
 * description looks like wood/timber and the shipment is not explicitly
 * certified (null or false both count as "not certified"), that is a critical
 * blocker: many destinations reject or quarantine uncertified wood packaging.
 */
export const woodPackagingRule: Rule = {
  code: 'WOOD_PACKAGING',
  description: 'Wood packaging must carry ISPM-15 certification.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    if (isMissing(shipment.packagingType)) return [];
    const packaging = (shipment.packagingType as string).toLowerCase();
    const isWood = ctx.config.WOOD_KEYWORDS.some((keyword) => packaging.includes(keyword));
    if (!isWood) return [];
    if (shipment.ispm15Certified === true) return [];

    return [
      {
        ruleCode: 'WOOD_PACKAGING_CERT_MISSING',
        issueType: 'missing_certification',
        severity: 'critical',
        field: 'ispm15Certified',
        explanation: `Packaging "${shipment.packagingType}" appears to be wood, but ISPM-15 certification is ${shipment.ispm15Certified === false ? 'marked absent' : 'not recorded'}. Uncertified wood packaging can be rejected or quarantined at destination.`,
        suggestedAction: 'Obtain the ISPM-15 fumigation/heat-treatment certificate before arrival.',
      },
    ];
  },
};
