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

/** Explicit snake_case -> camelCase mapping so the translation is easy to audit. */
export function toShipmentWriteData(body: CreateShipmentBody): ShipmentWriteData {
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
    billOfLading: body.bill_of_lading ?? null,
    packagingType: body.packaging_type ?? null,
    ispm15Certified: body.ispm15_certified ?? null,
    arrivalDate: body.arrival_date ?? null,
  };
}
