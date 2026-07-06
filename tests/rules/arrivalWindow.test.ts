import { describe, expect, it } from 'vitest';
import { arrivalWindowRule } from '../../src/validation/rules/arrivalWindow.js';
import { makeContext, makeSnapshot } from '../factories.js';

describe('arrivalWindow rule', () => {
  // FIXED_NOW is 2026-07-06; the review window is 14 days, so the cutoff is 2026-06-22.
  const ctx = makeContext();
  const codes = (arrival: string) =>
    arrivalWindowRule.check(makeSnapshot({ arrivalDate: new Date(arrival) }), ctx).map((i) => i.ruleCode);

  it('flags an arrival older than the window (assignment sample 2026-06-20)', () => {
    expect(codes('2026-06-20T00:00:00.000Z')).toEqual(['ARRIVAL_DATE_OUT_OF_REVIEW_WINDOW']);
  });

  it('accepts a recent arrival', () => {
    expect(codes('2026-06-25T00:00:00.000Z')).toHaveLength(0);
  });

  it('treats exactly the window boundary as within window', () => {
    expect(codes('2026-06-22T00:00:00.000Z')).toHaveLength(0);
  });

  it('accepts a normal near-future arrival (within the plausibility window)', () => {
    expect(codes('2026-08-01T00:00:00.000Z')).toHaveLength(0);
  });

  it('flags an implausibly far-future arrival (OCR/data error, e.g. 2062)', () => {
    expect(codes('2062-06-20T00:00:00.000Z')).toEqual(['ARRIVAL_DATE_IMPLAUSIBLE_FUTURE']);
  });

  it('skips when arrival date is absent', () => {
    expect(arrivalWindowRule.check(makeSnapshot({ arrivalDate: null }), ctx)).toHaveLength(0);
  });
});
