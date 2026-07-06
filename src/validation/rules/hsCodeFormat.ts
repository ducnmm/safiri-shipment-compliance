import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing, normalizeHsCode } from '../util.js';

/**
 * Rule 2 — HS code format check. Skips when the code is absent (rule 1 covers
 * that). A code is invalid if, after stripping separators, it contains
 * non-digits, has a non-standard length, or starts with an unknown/reserved
 * chapter. This checks FORMAT and chapter existence, not full classification.
 */
export const hsCodeFormatRule: Rule = {
  code: 'HS_CODE_FORMAT',
  description: 'HS code must be well-formed and use a known chapter.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    if (isMissing(shipment.hsCode)) return [];
    const raw = shipment.hsCode as string;
    const normalized = normalizeHsCode(raw);

    const reasons: string[] = [];
    const allowedLengths: readonly number[] = ctx.config.HS_ALLOWED_LENGTHS;
    if (!/^\d+$/.test(normalized)) {
      reasons.push('it contains non-numeric characters');
    } else {
      if (!allowedLengths.includes(normalized.length)) {
        reasons.push(
          `its length (${normalized.length}) is not one of ${ctx.config.HS_ALLOWED_LENGTHS.join('/')} digits`,
        );
      }
      const chapter = normalized.slice(0, 2);
      if (normalized.length >= 2 && !ctx.hsChapters.has(chapter)) {
        reasons.push(`chapter "${chapter}" is not a valid HS chapter`);
      }
    }

    if (reasons.length === 0) return [];
    return [
      {
        ruleCode: 'INVALID_HS_CODE_FORMAT',
        issueType: 'invalid_hs_code_format',
        severity: 'high',
        field: 'hsCode',
        explanation: `HS code "${raw}" is invalid: ${reasons.join('; ')}.`,
        suggestedAction: 'Verify the HS code against the WCO Harmonized System nomenclature.',
      },
    ];
  },
};
