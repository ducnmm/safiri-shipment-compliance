import { describe, expect, it } from 'vitest';
import { weightConsistencyRule } from '../../src/validation/rules/weightConsistency.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('weightConsistency rule', () => {
  const ctx = makeContext();
  const codes = (gross: number | null, net: number | null) =>
    weightConsistencyRule
      .check(makeSnapshot({ grossWeightKg: gross, netWeightKg: net }), ctx)
      .map((i) => i.ruleCode);

  it('accepts gross greater than net', () => {
    expect(codes(12750, 12100)).toHaveLength(0);
  });

  it('accepts equal gross and net', () => {
    expect(codes(12000, 12000)).toHaveLength(0);
  });

  it('flags gross lower than net', () => {
    expect(codes(100, 200)).toContain('WEIGHT_INCONSISTENT');
  });

  it('flags a non-positive weight', () => {
    expect(codes(12750, 0)).toContain('WEIGHT_NON_POSITIVE');
  });
});
