import { z } from 'zod';

/**
 * Request schemas live at the API boundary. They validate the *shape* of input
 * (types, required reference) — NOT business compliance, which is the rule
 * engine's job. The public API speaks snake_case (matching the assignment's
 * sample payload); internally we use camelCase.
 */

const optionalString = z.string().min(1).nullable().optional();
const optionalNumber = z.number().finite().nullable().optional();

/** POST /shipments body. `reference` is the only required field; dirty/partial data is allowed by design. */
export const createShipmentBodySchema = z
  .object({
    shipment_reference: z.string().min(1, 'shipment_reference is required'),
    exporter: optionalString,
    importer: optionalString,
    invoice_number: optionalString,
    invoice_value: optionalNumber,
    currency: optionalString,
    goods_description: optionalString,
    hs_code: optionalString,
    country_of_origin: optionalString,
    gross_weight_kg: optionalNumber,
    net_weight_kg: optionalNumber,
    number_of_packages: z.number().int().nullable().optional(),
    container_number: optionalString,
    bill_of_lading: optionalString,
    // The assignment's sample payload spells this `bill_of_lading_number`; we
    // accept it as an alias so the sample pastes verbatim, and canonicalise to
    // `bill_of_lading` in toShipmentWriteData().
    bill_of_lading_number: optionalString,
    packaging_type: optionalString,
    ispm15_certified: z.boolean().nullable().optional(),
    arrival_date: z.coerce.date().nullable().optional(),
  })
  .strict();

export type CreateShipmentBody = z.infer<typeof createShipmentBodySchema>;

/** Canonical (camelCase) shape written to the shipment record. */
export interface ShipmentWriteData {
  reference: string;
  exporter: string | null;
  importer: string | null;
  invoiceNumber: string | null;
  invoiceValue: number | null;
  currency: string | null;
  goodsDescription: string | null;
  hsCode: string | null;
  countryOfOrigin: string | null;
  grossWeightKg: number | null;
  netWeightKg: number | null;
  numberOfPackages: number | null;
  containerNumber: string | null;
  billOfLading: string | null;
  packagingType: string | null;
  ispm15Certified: boolean | null;
  arrivalDate: Date | null;
}

/** Coerce common truthy/falsy CSV spellings into a boolean. */
const booleanFromString = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return v; // anything else -> let z.boolean() reject it
}, z.boolean());

/** Treat an empty CSV cell as "not provided". */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/**
 * A single CSV row for bulk import. Cells arrive as strings, so numbers, the
 * boolean, and the date are coerced, and empty cells become undefined.
 */
export const csvShipmentRowSchema = z.object({
  shipment_reference: z.string().min(1, 'shipment_reference is required'),
  exporter: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  importer: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  invoice_number: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  invoice_value: z.preprocess(emptyToUndefined, z.coerce.number().finite().optional()),
  currency: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  goods_description: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  hs_code: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  country_of_origin: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  gross_weight_kg: z.preprocess(emptyToUndefined, z.coerce.number().finite().optional()),
  net_weight_kg: z.preprocess(emptyToUndefined, z.coerce.number().finite().optional()),
  number_of_packages: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  container_number: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  bill_of_lading: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  bill_of_lading_number: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  packaging_type: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ispm15_certified: z.preprocess(emptyToUndefined, booleanFromString.optional()),
  arrival_date: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export type CsvShipmentRow = z.infer<typeof csvShipmentRowSchema>;

/**
 * GET /shipments query params — bounded pagination. Non-strict so unrelated
 * query params (cache-busters, etc.) don't 400. Both values are coerced from
 * strings and defaulted, so `GET /shipments` with no params returns the newest 50.
 */
export const listShipmentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;

/** PATCH /shipments/:id/status body — a human approve/reject decision. */
export const patchStatusBodySchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
  })
  .strict();

export type PatchStatusBody = z.infer<typeof patchStatusBodySchema>;

/** POST /shipments/:id/documents body. `payload` is the raw (mock OCR) document object. */
export const ingestDocumentBodySchema = z
  .object({
    source: z.string().min(1).optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type IngestDocumentBody = z.infer<typeof ingestDocumentBodySchema>;

/** Structural input accepted by the shipment mapper (JSON body or a CSV row). */
export interface ShipmentBodyInput {
  shipment_reference: string;
  exporter?: string | null;
  importer?: string | null;
  invoice_number?: string | null;
  invoice_value?: number | null;
  currency?: string | null;
  goods_description?: string | null;
  hs_code?: string | null;
  country_of_origin?: string | null;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  number_of_packages?: number | null;
  container_number?: string | null;
  bill_of_lading?: string | null;
  /** Alias for `bill_of_lading` (the assignment sample's field name). */
  bill_of_lading_number?: string | null;
  packaging_type?: string | null;
  ispm15_certified?: boolean | null;
  arrival_date?: Date | null;
}

/** Explicit snake_case -> camelCase mapping so the translation is easy to audit. */
export function toShipmentWriteData(body: ShipmentBodyInput): ShipmentWriteData {
  return {
    reference: body.shipment_reference,
    exporter: body.exporter ?? null,
    importer: body.importer ?? null,
    invoiceNumber: body.invoice_number ?? null,
    invoiceValue: body.invoice_value ?? null,
    currency: body.currency ?? null,
    goodsDescription: body.goods_description ?? null,
    hsCode: body.hs_code ?? null,
    countryOfOrigin: body.country_of_origin ?? null,
    grossWeightKg: body.gross_weight_kg ?? null,
    netWeightKg: body.net_weight_kg ?? null,
    numberOfPackages: body.number_of_packages ?? null,
    containerNumber: body.container_number ?? null,
    billOfLading: body.bill_of_lading ?? body.bill_of_lading_number ?? null,
    packagingType: body.packaging_type ?? null,
    ispm15Certified: body.ispm15_certified ?? null,
    arrivalDate: body.arrival_date ?? null,
  };
}
