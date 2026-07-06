import { describe, expect, it } from 'vitest';
import { countryOfOriginRule } from '../../src/validation/rules/countryOfOrigin.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('countryOfOrigin / currency rule', () => {
  const ctx = makeContext();
  const codes = (snapshot = makeSnapshot()) =>
    countryOfOriginRule.check(snapshot, ctx).map((i) => i.ruleCode);

  it('accepts valid country and currency codes', () => {
    expect(codes()).toHaveLength(0);
  });

  it('flags missing country of origin as high', () => {
    const issues = countryOfOriginRule.check(makeSnapshot({ countryOfOrigin: null }), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('MISSING_COUNTRY_OF_ORIGIN');
    expect(issues[0]?.severity).toBe('high');
  });

  it('flags an unknown country code as medium', () => {
    const issues = countryOfOriginRule.check(makeSnapshot({ countryOfOrigin: 'XX' }), ctx);
    expect(issues[0]?.ruleCode).toBe('INVALID_COUNTRY_CODE');
    expect(issues[0]?.severity).toBe('medium');
  });

  it('accepts a lowercase country code (case-insensitive)', () => {
    expect(codes(makeSnapshot({ countryOfOrigin: 'cn' }))).toHaveLength(0);
  });

  it('flags an unknown currency code', () => {
    expect(codes(makeSnapshot({ currency: 'US$' }))).toContain('INVALID_CURRENCY_CODE');
  });
});
