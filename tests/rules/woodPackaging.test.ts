import { describe, expect, it } from 'vitest';
import { woodPackagingRule } from '../../src/validation/rules/woodPackaging.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('woodPackaging rule', () => {
  const ctx = makeContext();
  const codes = (packagingType: string | null, ispm15Certified: boolean | null) =>
    woodPackagingRule
      .check(makeSnapshot({ packagingType, ispm15Certified }), ctx)
      .map((i) => i.ruleCode);

  it('flags wooden packaging with no certification (assignment sample)', () => {
    expect(codes('wooden crates', null)).toEqual(['WOOD_PACKAGING_CERT_MISSING']);
  });

  it('flags wooden packaging explicitly marked uncertified', () => {
    expect(codes('wooden crates', false)).toEqual(['WOOD_PACKAGING_CERT_MISSING']);
  });

  it('accepts wooden packaging that is certified', () => {
    expect(codes('wooden crates', true)).toHaveLength(0);
  });

  it('ignores non-wood packaging', () => {
    expect(codes('cartons', null)).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(codes('WOODEN CRATES', null)).toEqual(['WOOD_PACKAGING_CERT_MISSING']);
  });

  it('produces a critical severity', () => {
    const issues = woodPackagingRule.check(
      makeSnapshot({ packagingType: 'wooden crates', ispm15Certified: null }),
      ctx,
    );
    expect(issues[0]?.severity).toBe('critical');
  });
});
