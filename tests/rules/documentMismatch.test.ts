import { describe, expect, it } from 'vitest';
import { documentMismatchRule } from '../../src/validation/rules/documentMismatch.js';
import { makeContext, makeDocumentView, makeSnapshot } from '../factories.js';

describe('documentMismatch rule', () => {
  it('flags an invoice value mismatch as high and shows both values', () => {
    const ctx = makeContext({
      documents: [makeDocumentView({ invoiceValue: 50000 })],
    });
    const issues = documentMismatchRule.check(makeSnapshot({ invoiceValue: 48250 }), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.ruleCode).toBe('DOCUMENT_SHIPMENT_MISMATCH');
    expect(issues[0]?.severity).toBe('high');
    expect(issues[0]?.explanation).toContain('48250');
    expect(issues[0]?.explanation).toContain('50000');
  });

  it('does not flag equal values', () => {
    const ctx = makeContext({ documents: [makeDocumentView({ invoiceValue: 48250 })] });
    expect(documentMismatchRule.check(makeSnapshot({ invoiceValue: 48250 }), ctx)).toHaveLength(0);
  });

  it('ignores fields the document does not carry', () => {
    const ctx = makeContext({ documents: [makeDocumentView({ invoiceValue: null })] });
    expect(documentMismatchRule.check(makeSnapshot(), ctx)).toHaveLength(0);
  });

  it('compares strings case-insensitively and trimmed', () => {
    const ctx = makeContext({ documents: [makeDocumentView({ billOfLading: '  bl-sha-7788 ' })] });
    expect(documentMismatchRule.check(makeSnapshot({ billOfLading: 'BL-SHA-7788' }), ctx)).toHaveLength(0);
  });

  it('flags a non-invoice mismatch as medium', () => {
    const ctx = makeContext({ documents: [makeDocumentView({ containerNumber: 'CSQU3054383' })] });
    const issues = documentMismatchRule.check(makeSnapshot({ containerNumber: 'MSCU1234567' }), ctx);
    expect(issues[0]?.severity).toBe('medium');
  });
});
