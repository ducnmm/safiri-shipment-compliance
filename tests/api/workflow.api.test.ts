import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as validationService from '../../src/services/validationService.js';
import { buildTestApp, prisma, SAMPLE_PAYLOAD } from '../helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  // Freeze time so the arrival-window rule is deterministic regardless of when tests run.
  validationService._setClock(() => new Date('2026-07-06T12:00:00.000Z'));
});

afterAll(async () => {
  validationService._setClock(null);
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.validationIssue.deleteMany();
  await prisma.validationRun.deleteMany();
  await prisma.document.deleteMany();
  await prisma.shipment.deleteMany();
});

const createSample = async (): Promise<string> => {
  const res = await app.inject({ method: 'POST', url: '/shipments', payload: SAMPLE_PAYLOAD });
  return res.json().id as string;
};

/** True if `needles` appear in `haystack` in order (not necessarily contiguously). */
function isSubsequence(haystack: string[], needles: string[]): boolean {
  let i = 0;
  for (const item of haystack) {
    if (item === needles[i]) i += 1;
  }
  return i === needles.length;
}

describe('end-to-end sample workflow', () => {
  it('validates the assignment sample to blocked with the three expected issues', async () => {
    const id = await createSample();
    const res = await app.inject({ method: 'POST', url: `/shipments/${id}/validate` });
    const body = res.json();

    expect(body.status).toBe('blocked');
    const codes = body.issues.map((i: { rule_code: string }) => i.rule_code);
    expect(codes).toContain('WOOD_PACKAGING_CERT_MISSING'); // critical
    expect(codes).toContain('ARRIVAL_DATE_OUT_OF_REVIEW_WINDOW'); // high
    expect(codes).toContain('INVALID_CONTAINER_NUMBER'); // high (check digit)
  });

  it('produces a readiness report with a blocker and human-review flag', async () => {
    const id = await createSample();
    await app.inject({ method: 'POST', url: `/shipments/${id}/validate` });
    const res = await app.inject({ method: 'GET', url: `/shipments/${id}/readiness-report` });
    const report = res.json();

    expect(res.statusCode).toBe(200);
    expect(report.current_status).toBe('blocked');
    expect(report.critical_blockers.length).toBeGreaterThanOrEqual(1);
    expect(report.human_review_required).toBe(true);
    expect(report.issues_by_severity.critical).toBeGreaterThanOrEqual(1);
    expect(report.suggested_next_actions).toContain('Resolve critical blockers and re-run validation.');
  });

  it('returns 409 for a readiness report before validation', async () => {
    const id = await createSample();
    const res = await app.inject({ method: 'GET', url: `/shipments/${id}/readiness-report` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_STATE');
  });

  it('surfaces a document/shipment mismatch without overwriting the shipment value', async () => {
    const id = await createSample();
    await app.inject({
      method: 'POST',
      url: `/shipments/${id}/documents`,
      payload: { source: 'partner_feed', payload: { invoice_value: 50000 } },
    });
    const validate = await app.inject({ method: 'POST', url: `/shipments/${id}/validate` });
    const codes = validate.json().issues.map((i: { rule_code: string }) => i.rule_code);
    expect(codes).toContain('DOCUMENT_SHIPMENT_MISMATCH');

    const shipment = await app.inject({ method: 'GET', url: `/shipments/${id}` });
    expect(shipment.json().invoice_value).toBe(48250); // unchanged
  });

  it('cannot approve a blocked shipment (409)', async () => {
    const id = await createSample();
    await app.inject({ method: 'POST', url: `/shipments/${id}/validate` }); // -> blocked
    const res = await app.inject({
      method: 'PATCH',
      url: `/shipments/${id}/status`,
      payload: { status: 'approved' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_STATE');
  });

  it('validates a corrected shipment to ready and approves it, with a full audit trail', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/shipments',
      headers: { 'x-actor': 'reviewer-1' },
      payload: {
        ...SAMPLE_PAYLOAD,
        shipment_reference: 'SAF-IMP-2026-0008', // distinct ref to avoid the duplicate rule
        container_number: 'CSQU3054383', // valid check digit
        ispm15_certified: true,
        arrival_date: '2026-07-01', // within the review window
      },
    });
    const id = create.json().id as string;

    const validate = await app.inject({
      method: 'POST',
      url: `/shipments/${id}/validate`,
      headers: { 'x-actor': 'reviewer-1' },
    });
    expect(validate.json().status).toBe('ready');
    expect(validate.json().issue_count).toBe(0);

    const approve = await app.inject({
      method: 'PATCH',
      url: `/shipments/${id}/status`,
      headers: { 'x-actor': 'reviewer-1' },
      payload: { status: 'approved' },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().status).toBe('approved');

    const audit = await app.inject({ method: 'GET', url: `/shipments/${id}/audit-log` });
    const actions = audit.json().map((a: { action: string }) => a.action);
    expect(
      isSubsequence(actions, [
        'shipment.created',
        'validation.run_completed',
        'shipment.status_changed',
      ]),
    ).toBe(true);
    // The manual decision was attributed to the actor from the x-actor header.
    const decision = audit.json().find((a: { action: string }) => a.action === 'shipment.status_changed');
    expect(decision.actor).toBe('reviewer-1');
  });
});
