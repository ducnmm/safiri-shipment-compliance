import { describe, expect, it } from 'vitest';
import { requiredFieldsRule } from '../../src/validation/rules/requiredFields.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('requiredFields rule', () => {
  const ctx = makeContext();

  it('produces no issues when all required fields are present', () => {
    expect(requiredFieldsRule.check(makeSnapshot(), ctx)).toHaveLength(0);
  });

  it('flags exactly the missing fields', () => {
    const snapshot = makeSnapshot({ exporter: null, invoiceNumber: null, hsCode: '' });
    const issues = requiredFieldsRule.check(snapshot, ctx);
    expect(issues).toHaveLength(3);
    expect(issues.map((i) => i.field).sort()).toEqual(['exporter', 'hsCode', 'invoiceNumber']);
    expect(issues.every((i) => i.ruleCode === 'MISSING_REQUIRED_FIELD')).toBe(true);
    expect(issues.every((i) => i.severity === 'high')).toBe(true);
  });

  it('treats numeric zero as present (not missing)', () => {
    const issues = requiredFieldsRule.check(makeSnapshot({ invoiceValue: 0, numberOfPackages: 0 }), ctx);
    expect(issues.map((i) => i.field)).not.toContain('invoiceValue');
    expect(issues.map((i) => i.field)).not.toContain('numberOfPackages');
  });
});
