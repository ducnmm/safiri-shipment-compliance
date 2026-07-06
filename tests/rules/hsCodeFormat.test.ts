import { describe, expect, it } from 'vitest';
import { hsCodeFormatRule } from '../../src/validation/rules/hsCodeFormat.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('hsCodeFormat rule', () => {
  const ctx = makeContext();
  const check = (hsCode: string | null) => hsCodeFormatRule.check(makeSnapshot({ hsCode }), ctx);

  it('accepts a well-formed code with a known chapter', () => {
    expect(check('8413.70')).toHaveLength(0); // chapter 84
    expect(check('847130')).toHaveLength(0);
  });

  it('rejects a code with the wrong length', () => {
    const issues = check('84');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('INVALID_HS_CODE_FORMAT');
  });

  it('rejects a non-numeric code', () => {
    expect(check('abc123')[0]?.ruleCode).toBe('INVALID_HS_CODE_FORMAT');
  });

  it('rejects a reserved chapter (77)', () => {
    expect(check('7701.00')).toHaveLength(1);
  });

  it('rejects an out-of-range chapter (99)', () => {
    expect(check('990000')).toHaveLength(1);
  });

  it('skips when the code is absent (rule 1 covers that)', () => {
    expect(check(null)).toHaveLength(0);
  });
});
