import { describe, expect, it } from 'vitest';
import { containerNumberRule } from '../../src/validation/rules/containerNumber.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('containerNumber rule', () => {
  const ctx = makeContext();
  const check = (containerNumber: string | null) =>
    containerNumberRule.check(makeSnapshot({ containerNumber }), ctx);

  it('accepts a valid container number', () => {
    expect(check('CSQU3054383')).toHaveLength(0);
  });

  it('flags a bad check digit', () => {
    const issues = check('MSCU1234567');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('INVALID_CONTAINER_NUMBER');
    expect(issues[0]?.explanation).toContain('check-digit');
  });

  it('flags a malformed container number', () => {
    const issues = check('MSU1234567');
    expect(issues[0]?.explanation).toContain('ISO 6346 format');
  });

  it('skips when absent (optional for LCL)', () => {
    expect(check(null)).toHaveLength(0);
  });
});
