import { describe, expect, it } from 'vitest';
import { billOfLadingRule } from '../../src/validation/rules/billOfLading.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('billOfLading rule', () => {
  const ctx = makeContext();

  it('produces no issue when the B/L number is present', () => {
    expect(billOfLadingRule.check(makeSnapshot(), ctx)).toHaveLength(0);
  });

  it('flags a missing B/L number as critical', () => {
    const issues = billOfLadingRule.check(makeSnapshot({ billOfLading: null }), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('MISSING_BILL_OF_LADING');
    expect(issues[0]?.severity).toBe('critical');
  });
});
