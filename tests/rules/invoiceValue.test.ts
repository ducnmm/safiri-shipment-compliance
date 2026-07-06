import { describe, expect, it } from 'vitest';
import { invoiceValueRule } from '../../src/validation/rules/invoiceValue.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('invoiceValue rule', () => {
  const ctx = makeContext();
  const codes = (invoiceValue: number | null, grossWeightKg: number | null = 12750) =>
    invoiceValueRule.check(makeSnapshot({ invoiceValue, grossWeightKg }), ctx).map((i) => i.ruleCode);

  it('accepts a plausible value (sample 48250 over 12750 kg)', () => {
    expect(codes(48250, 12750)).toHaveLength(0);
  });

  it('flags a non-positive value as high', () => {
    expect(codes(0)).toEqual(['INVOICE_VALUE_NON_POSITIVE']);
    expect(codes(-5)).toEqual(['INVOICE_VALUE_NON_POSITIVE']);
  });

  it('flags an implausibly low value-per-kg', () => {
    expect(codes(5, 10000)).toEqual(['INVOICE_VALUE_SUSPICIOUS']);
  });

  it('flags an implausibly high value-per-kg', () => {
    expect(codes(1_000_000_000, 10)).toEqual(['INVOICE_VALUE_SUSPICIOUS']);
  });

  it('skips the plausibility check when weight is unknown', () => {
    expect(codes(5, null)).toHaveLength(0);
  });
});
