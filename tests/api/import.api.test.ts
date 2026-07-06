import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, prisma } from '../helpers.js';

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
  await prisma.shipment.deleteMany();
});

const importCsv = (csv: string) =>
  app.inject({
    method: 'POST',
    url: '/shipments/import',
    headers: { 'content-type': 'text/csv' },
    payload: csv,
  });

describe('CSV bulk import API', () => {
  it('imports valid rows and reports per-row success', async () => {
    const csv = [
      'shipment_reference,exporter,invoice_value,arrival_date,ispm15_certified',
      'SAF-1,Acme,1000,2026-06-01,true',
      'SAF-2,Globex,2000,2026-06-02,false',
    ].join('\n');

    const res = await importCsv(csv);
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.total).toBe(2);
    expect(body.created).toBe(2);
    expect(body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);

    expect(await prisma.shipment.count()).toBe(2);
  });

  it('imports good rows and reports bad rows independently', async () => {
    const csv = [
      'shipment_reference,invoice_value',
      'SAF-OK,1000',
      ',500', // missing reference -> row fails
      'SAF-BADNUM,not-a-number', // invalid number -> row fails
    ].join('\n');

    const res = await importCsv(csv);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.created).toBe(1);
    expect(body.failed).toBe(2);
    expect(body.results[0].ok).toBe(true);
    expect(body.results[1].ok).toBe(false);
    expect(body.results[2].ok).toBe(false);

    expect(await prisma.shipment.count()).toBe(1);
  });

  it('rejects an empty CSV with a 400 envelope', async () => {
    const res = await importCsv('shipment_reference\n');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
