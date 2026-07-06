import { describe, expect, it } from 'vitest';
import { checkContainerNumber, computeCheckDigit } from '../src/validation/iso6346.js';

describe('ISO 6346 check digit', () => {
  it('computes the published example check digit', () => {
    expect(computeCheckDigit('CSQU305438')).toBe(3);
  });

  it('accepts a valid container number', () => {
    expect(checkContainerNumber('CSQU3054383')).toEqual({ valid: true });
  });

  it('rejects the assignment sample MSCU1234567 on its check digit', () => {
    // The computed check digit is 6, not 7 — the sample number is invalid.
    expect(computeCheckDigit('MSCU123456')).toBe(6);
    expect(checkContainerNumber('MSCU1234567')).toEqual({ valid: false, reason: 'check_digit' });
  });

  it('rejects a malformed container number', () => {
    expect(checkContainerNumber('MSU1234567')).toEqual({ valid: false, reason: 'format' });
  });

  it('rejects a number whose check value resolves to 10 (no valid single digit)', () => {
    // MSCU000006 sums to 3464; 3464 % 11 === 10. A naive `(sum % 11) % 10` would
    // fold this to 0 and wrongly accept MSCU0000060 — we reject it instead.
    expect(computeCheckDigit('MSCU000006')).toBe(10);
    expect(checkContainerNumber('MSCU0000060')).toEqual({ valid: false, reason: 'check_digit' });
  });

  it('normalises case and whitespace', () => {
    expect(checkContainerNumber('  csqu3054383 ')).toEqual({ valid: true });
  });
});
