import { describe, expect, it } from 'vitest';
import { duplicateReferenceRule } from '../../src/validation/rules/duplicateReference.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('duplicateReference rule', () => {
  it('produces no issue when the reference is unique', () => {
    const ctx = makeContext({ duplicateReferenceCount: 0 });
    expect(duplicateReferenceRule.check(makeSnapshot(), ctx)).toHaveLength(0);
  });

  it('flags a duplicated reference', () => {
    const ctx = makeContext({ duplicateReferenceCount: 1 });
    const issues = duplicateReferenceRule.check(makeSnapshot(), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('DUPLICATE_SHIPMENT_REFERENCE');
    expect(issues[0]?.severity).toBe('high');
  });
});
