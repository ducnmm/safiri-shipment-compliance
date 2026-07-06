import { describe, expect, it } from 'vitest';
import { invoiceValueRule } from '../../src/validation/rules/invoiceValue.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('invoiceValue rule', () => {
  const ctx = makeContext();
  const codes = (
    invoiceValue: number | null,
    grossWeightKg: number | null = 12750,
    currency = 'USD',
  ) =>
    invoiceValueRule
      .check(makeSnapshot({ invoiceValue, grossWeightKg, currency }), ctx)
      .map((i) => i.ruleCode);

  it('accepts a plausible value (sample 48250 USD over 12750 kg)', () => {
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

  it('normalises to USD: 1.2bn VND over 12750 kg (~48k USD) is NOT suspicious', () => {
    // Raw value/kg would be ~94,117 and wrongly trip the band; normalised to
    // ~3.67 USD/kg it is plausible. This is the currency-naive bug fixed.
    expect(codes(1_200_000_000, 12750, 'VND')).toHaveLength(0);
  });

  it('still catches a genuinely low value in a non-USD currency', () => {
    // 100 JPY ≈ 0.67 USD over 10000 kg => ~0.00007 USD/kg, below the band.
    expect(codes(100, 10000, 'JPY')).toEqual(['INVOICE_VALUE_SUSPICIOUS']);
  });

  it('trims whitespace on the currency before the FX lookup', () => {
    // " USD " must behave exactly like "USD" (OCR often pads values).
    expect(codes(5, 10000, ' USD ')).toEqual(['INVOICE_VALUE_SUSPICIOUS']);
  });

  it('surfaces a LOW unchecked note for a valid ISO currency with no FX rate', () => {
    // ARS is a valid ISO 4217 code but not in the FX snapshot -> cannot normalise.
    expect(codes(5, 10000, 'ARS')).toEqual(['INVOICE_VALUE_PLAUSIBILITY_UNCHECKED']);
  });

  it('stays quiet when the currency is not a valid ISO code (rules 1/3 own that)', () => {
    expect(codes(5, 10000, 'US$')).toHaveLength(0);
  });
});
