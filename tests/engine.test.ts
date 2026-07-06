import { describe, expect, it } from 'vitest';
import { SEVERITY_RANK } from '../src/types.js';
import { runRules } from '../src/validation/engine.js';
import { makeContext, makeSnapshot } from './factories.js';

describe('validation engine', () => {
  it('returns issues sorted by severity, critical first', () => {
    const snapshot = makeSnapshot({
      billOfLading: null, // critical
      packagingType: 'wooden crates',
      ispm15Certified: null, // critical
      containerNumber: 'MSCU1234567', // high
      countryOfOrigin: 'XX', // medium
    });
    const issues = runRules(snapshot, makeContext());

    expect(issues.length).toBeGreaterThanOrEqual(4);
    expect(issues[0]?.severity).toBe('critical');

    // Severity ranks are monotonically non-increasing.
    for (let i = 1; i < issues.length; i += 1) {
      const prev = issues[i - 1];
      const curr = issues[i];
      if (prev && curr) {
        expect(SEVERITY_RANK[prev.severity]).toBeGreaterThanOrEqual(SEVERITY_RANK[curr.severity]);
      }
    }
  });

  it('returns no issues for a fully valid shipment', () => {
    expect(runRules(makeSnapshot(), makeContext())).toHaveLength(0);
  });
});
