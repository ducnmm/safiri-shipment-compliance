import { config } from '../src/config.js';
import { referenceData } from '../src/reference/referenceData.js';
import type { ShipmentSnapshot } from '../src/types.js';
import type { DocumentView, ValidationContext } from '../src/validation/types.js';

/** Fixed "now" used across rule tests so date-based rules are deterministic. */
export const FIXED_NOW = new Date('2026-07-06T00:00:00.000Z');

/**
 * A baseline shipment that PASSES every rule. Individual tests override one
 * field to trigger a specific rule, which keeps each test focused.
 */
export function makeSnapshot(overrides: Partial<ShipmentSnapshot> = {}): ShipmentSnapshot {
  return {
    id: 'ship_test',
    reference: 'SAF-IMP-2026-0007',
    exporter: 'BlueRiver Manufacturing Ltd',
    importer: 'Eastland Retail Group',
    invoiceNumber: 'INV-77821',
    invoiceValue: 48250,
    currency: 'USD',
    goodsDescription: 'Industrial water pumps and spare impellers',
    hsCode: '8413.70',
    countryOfOrigin: 'CN',
    grossWeightKg: 12750,
    netWeightKg: 12100,
    numberOfPackages: 42,
    containerNumber: 'CSQU3054383', // valid ISO 6346 check digit
    billOfLading: 'BL-SHA-7788',
    packagingType: 'wooden crates',
    ispm15Certified: true,
    arrivalDate: new Date('2026-07-01T00:00:00.000Z'), // within the review window
    status: 'documents_ingested',
    ...overrides,
  };
}

export function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    now: FIXED_NOW,
    countries: referenceData.countries,
    currencies: referenceData.currencies,
    hsChapters: referenceData.hsChapters,
    duplicateReferenceCount: 0,
    documents: [],
    config,
    ...overrides,
  };
}

export function makeDocumentView(mappedFields: Record<string, unknown>, id = 'doc_1'): DocumentView {
  return { id, mappedFields };
}
