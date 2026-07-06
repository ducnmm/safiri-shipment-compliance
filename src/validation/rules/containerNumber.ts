import type { ShipmentSnapshot } from '../../types.js';
import { checkContainerNumber } from '../iso6346.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing } from '../util.js';

/**
 * Rule 6 — container number validity (ISO 6346). Skipped when absent: containers
 * are optional for LCL (less-than-container-load) shipments, so a missing
 * container number is not itself an error. When present it must pass both the
 * format check and the check-digit calculation.
 */
export const containerNumberRule: Rule = {
  code: 'CONTAINER_NUMBER',
  description: 'Container number must be a valid ISO 6346 identifier.',
  check(shipment: ShipmentSnapshot, _ctx: ValidationContext): IssueDraft[] {
    if (isMissing(shipment.containerNumber)) return [];
    const raw = shipment.containerNumber as string;
    const result = checkContainerNumber(raw);
    if (result.valid) return [];

    const explanation =
      result.reason === 'format'
        ? `Container number "${raw}" does not match the ISO 6346 format (4 letters + 7 digits, e.g. "CSQU3054383").`
        : `Container number "${raw}" fails the ISO 6346 check-digit validation, indicating a typo or transcription error.`;

    return [
      {
        ruleCode: 'INVALID_CONTAINER_NUMBER',
        issueType: 'invalid_container_number',
        severity: 'high',
        field: 'containerNumber',
        explanation,
        suggestedAction: 'Verify the container number against the Bill of Lading and carrier records.',
      },
    ];
  },
};
