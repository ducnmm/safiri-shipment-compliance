import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';

/** Build a Fastify app wired to the per-suite isolated database (see setup.ts). */
export async function buildTestApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false });
}

export { prisma };

/** The assignment's sample shipment payload, reused across API tests and the seed. */
export const SAMPLE_PAYLOAD = {
  shipment_reference: 'SAF-IMP-2026-0007',
  exporter: 'BlueRiver Manufacturing Ltd',
  importer: 'Eastland Retail Group',
  invoice_number: 'INV-77821',
  invoice_value: 48250.0,
  currency: 'USD',
  goods_description: 'Industrial water pumps and spare impellers',
  hs_code: '8413.70',
  country_of_origin: 'CN',
  gross_weight_kg: 12750,
  net_weight_kg: 12100,
  number_of_packages: 42,
  container_number: 'MSCU1234567',
  bill_of_lading: 'BL-SHA-7788',
  packaging_type: 'wooden crates',
  ispm15_certified: null,
  arrival_date: '2026-06-20',
} as const;
