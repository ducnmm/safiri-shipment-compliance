import type { ShipmentSnapshot } from '../../types.js';
import type { IssueDraft, Rule, ValidationContext } from '../types.js';
import { isMissing } from '../util.js';

/**
 * Rule 3 — reference-code validity for country of origin and currency.
 *  - Missing country of origin is a HIGH issue (origin drives duty/quotas).
 *  - A present-but-unknown country code is MEDIUM (likely a data-entry slip).
 *  - A present-but-unknown currency code is MEDIUM.
 * Missing currency itself is covered by rule 1 (it is a required field).
 */
export const countryOfOriginRule: Rule = {
  code: 'COUNTRY_AND_CURRENCY_CODES',
  description: 'Country of origin and currency must be valid ISO codes.',
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[] {
    const issues: IssueDraft[] = [];

    if (isMissing(shipment.countryOfOrigin)) {
      issues.push({
        ruleCode: 'MISSING_COUNTRY_OF_ORIGIN',
        issueType: 'missing_country_of_origin',
        severity: 'high',
        field: 'countryOfOrigin',
        explanation: 'Country of origin is missing.',
        suggestedAction: 'Confirm the country of origin with the exporter.',
      });
    } else {
      const code = (shipment.countryOfOrigin as string).trim().toUpperCase();
      if (!ctx.countries.has(code)) {
        issues.push({
          ruleCode: 'INVALID_COUNTRY_CODE',
          issueType: 'invalid_country_code',
          severity: 'medium',
          field: 'countryOfOrigin',
          explanation: `Country of origin "${shipment.countryOfOrigin}" is not a valid ISO 3166-1 alpha-2 code.`,
          suggestedAction: 'Use the ISO 3166-1 alpha-2 country code (e.g. "CN", "US").',
        });
      }
    }

    if (!isMissing(shipment.currency)) {
      const code = (shipment.currency as string).trim().toUpperCase();
      if (!ctx.currencies.has(code)) {
        issues.push({
          ruleCode: 'INVALID_CURRENCY_CODE',
          issueType: 'invalid_currency_code',
          severity: 'medium',
          field: 'currency',
          explanation: `Currency "${shipment.currency}" is not a valid ISO 4217 code.`,
          suggestedAction: 'Use the ISO 4217 currency code (e.g. "USD", "EUR").',
        });
      }
    }

    return issues;
  },
};
