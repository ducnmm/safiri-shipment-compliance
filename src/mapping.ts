import { z } from 'zod';

/**
 * Field-mapping rules for turning a raw document payload (snake_case, possibly
 * dirty) into the canonical camelCase shipment fields.
 *
 * Ingestion is deliberately lenient: a value that fails to coerce is skipped
 * (left only in the raw payload) rather than rejecting the whole document — the
 * point of the system is to surface bad data downstream, not to bounce it at
 * the door.
 */
const FIELD_DEFS = [
  { snake: 'shipment_reference', camel: 'reference', schema: z.string().min(1) },
  { snake: 'exporter', camel: 'exporter', schema: z.string().min(1) },
  { snake: 'importer', camel: 'importer', schema: z.string().min(1) },
  { snake: 'invoice_number', camel: 'invoiceNumber', schema: z.string().min(1) },
  { snake: 'invoice_value', camel: 'invoiceValue', schema: z.number().finite() },
  { snake: 'currency', camel: 'currency', schema: z.string().min(1) },
  { snake: 'goods_description', camel: 'goodsDescription', schema: z.string().min(1) },
  { snake: 'hs_code', camel: 'hsCode', schema: z.string().min(1) },
  { snake: 'country_of_origin', camel: 'countryOfOrigin', schema: z.string().min(1) },
  { snake: 'gross_weight_kg', camel: 'grossWeightKg', schema: z.number().finite() },
  { snake: 'net_weight_kg', camel: 'netWeightKg', schema: z.number().finite() },
  { snake: 'number_of_packages', camel: 'numberOfPackages', schema: z.number().int() },
  { snake: 'container_number', camel: 'containerNumber', schema: z.string().min(1) },
  { snake: 'bill_of_lading', camel: 'billOfLading', schema: z.string().min(1) },
  // Alias: the assignment sample names this `bill_of_lading_number`.
  { snake: 'bill_of_lading_number', camel: 'billOfLading', schema: z.string().min(1) },
  { snake: 'packaging_type', camel: 'packagingType', schema: z.string().min(1) },
  { snake: 'ispm15_certified', camel: 'ispm15Certified', schema: z.boolean() },
  { snake: 'arrival_date', camel: 'arrivalDate', schema: z.coerce.date() },
] as const;

const KNOWN_SNAKE_KEYS = new Set<string>(FIELD_DEFS.map((f) => f.snake));

export interface MappedDocument {
  /** Recognized fields, keyed by canonical camelCase name, with coerced values. */
  mapped: Record<string, unknown>;
  /** Known keys whose values failed to coerce and were left unmapped. */
  skipped: string[];
  /** Keys in the payload we don't recognise (kept in the raw payload only). */
  unknownKeys: string[];
}

/** Map a raw document payload into canonical shipment fields (lenient). */
export function mapDocumentPayload(payload: Record<string, unknown>): MappedDocument {
  const mapped: Record<string, unknown> = {};
  const skipped: string[] = [];

  for (const def of FIELD_DEFS) {
    if (!(def.snake in payload)) continue;
    const raw = payload[def.snake];
    if (raw === null || raw === undefined) continue; // present but empty — nothing to map
    const result = def.schema.safeParse(raw);
    if (result.success) {
      mapped[def.camel] = result.data;
    } else {
      skipped.push(def.snake);
    }
  }

  const unknownKeys = Object.keys(payload).filter((k) => !KNOWN_SNAKE_KEYS.has(k));
  return { mapped, skipped, unknownKeys };
}
