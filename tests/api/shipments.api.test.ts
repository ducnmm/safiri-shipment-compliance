import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, prisma, SAMPLE_PAYLOAD } from '../helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
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

async function createSample(): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/shipments', payload: SAMPLE_PAYLOAD });
  return res.json().id as string;
}

describe('shipment CRUD API', () => {
  it('creates a shipment (201) and echoes snake_case fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/shipments', payload: SAMPLE_PAYLOAD });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.shipment_reference).toBe('SAF-IMP-2026-0007');
    expect(body.status).toBe('draft');
    expect(body.arrival_date).toBe('2026-06-20');
  });

  it('accepts the assignment sample verbatim, incl. its bill_of_lading_number field name', async () => {
    // The PDF sample names the field `bill_of_lading_number`; the canonical API
    // field is `bill_of_lading`. It must be accepted as an alias so the sample
    // can be pasted verbatim, and canonicalised on the way in.
    const { bill_of_lading, ...rest } = SAMPLE_PAYLOAD;
    const pdfVerbatim = { ...rest, bill_of_lading_number: bill_of_lading };
    const res = await app.inject({ method: 'POST', url: '/shipments', payload: pdfVerbatim });
    expect(res.statusCode).toBe(201);
    expect(res.json().bill_of_lading).toBe('BL-SHA-7788');
  });

  it('rejects a missing reference with a 400 envelope', async () => {
    const res = await app.inject({ method: 'POST', url: '/shipments', payload: { exporter: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a 404 envelope for an unknown shipment', async () => {
    const res = await app.inject({ method: 'GET', url: '/shipments/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('lists shipments newest first', async () => {
    await app.inject({ method: 'POST', url: '/shipments', payload: { shipment_reference: 'A' } });
    await app.inject({ method: 'POST', url: '/shipments', payload: { shipment_reference: 'B' } });
    const res = await app.inject({ method: 'GET', url: '/shipments' });
    const refs = res.json().map((s: { shipment_reference: string }) => s.shipment_reference);
    expect(refs).toEqual(['B', 'A']);
  });

  it('paginates with ?limit & ?offset and reports the total in a header', async () => {
    for (const ref of ['A', 'B', 'C']) {
      await app.inject({ method: 'POST', url: '/shipments', payload: { shipment_reference: ref } });
    }
    const page1 = await app.inject({ method: 'GET', url: '/shipments?limit=2&offset=0' });
    expect(page1.headers['x-total-count']).toBe('3');
    expect(page1.json().map((s: { shipment_reference: string }) => s.shipment_reference)).toEqual(['C', 'B']);

    const page2 = await app.inject({ method: 'GET', url: '/shipments?limit=2&offset=2' });
    expect(page2.json().map((s: { shipment_reference: string }) => s.shipment_reference)).toEqual(['A']);
  });

  it('rejects an out-of-range limit with a 400 envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/shipments?limit=0' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validation API', () => {
  it('validates the sample and blocks it (critical ISPM-15 issue)', async () => {
    const id = await createSample();
    const res = await app.inject({ method: 'POST', url: `/shipments/${id}/validate` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('blocked');
    const codes = body.issues.map((i: { rule_code: string }) => i.rule_code);
    expect(codes).toContain('WOOD_PACKAGING_CERT_MISSING');
    expect(codes).toContain('ARRIVAL_DATE_OUT_OF_REVIEW_WINDOW');
    expect(codes).toContain('INVALID_CONTAINER_NUMBER');
    expect(body.issues[0].severity).toBe('critical');
  });

  it('returns issues from the latest run', async () => {
    const id = await createSample();
    await app.inject({ method: 'POST', url: `/shipments/${id}/validate` });
    const res = await app.inject({ method: 'GET', url: `/shipments/${id}/issues` });
    expect(res.statusCode).toBe(200);
    expect(res.json().issues.length).toBeGreaterThan(0);
  });

  it('returns 409 when requesting issues before any validation', async () => {
    const id = await createSample();
    const res = await app.inject({ method: 'GET', url: `/shipments/${id}/issues` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_STATE');
  });
});
