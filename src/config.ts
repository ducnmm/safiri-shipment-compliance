/**
 * Central configuration for tunable validation thresholds and rule inputs.
 *
 * Every "magic number" or business assumption in the validation engine lives
 * here so that (a) the README can document each one in a single place and
 * (b) rules stay declarative. In production these would move to per-tenant
 * configuration or a rules-management service.
 */
export const config = {
  /** Arrival dates strictly older than (now - this many days) fall outside the operational review window. */
  REVIEW_WINDOW_DAYS: 14,

  /**
   * Suspicious-invoice heuristic. We flag invoice values whose value-per-kg
   * falls outside this band. This is deliberately currency-naive (see README):
   * a production system would normalise to a base currency first.
   */
  SUSPICIOUS_MIN_VALUE_PER_KG: 0.1,
  SUSPICIOUS_MAX_VALUE_PER_KG: 10_000,

  /** Packaging descriptions containing any of these tokens are treated as wood packaging (ISPM-15 scope). */
  WOOD_KEYWORDS: ['wood', 'wooden', 'timber', 'pallet', 'crate'],

  /** Valid international HS code lengths: 6 (WCO), 8/10 (national extensions). */
  HS_ALLOWED_LENGTHS: [6, 8, 10],

  /**
   * Fields required for a shipment to be considered documentation-complete.
   * `countryOfOrigin` and `billOfLading` are intentionally excluded here
   * because they have dedicated rules with their own severities.
   */
  REQUIRED_FIELDS: [
    'reference',
    'exporter',
    'importer',
    'invoiceNumber',
    'invoiceValue',
    'currency',
    'goodsDescription',
    'hsCode',
    'grossWeightKg',
    'netWeightKg',
    'numberOfPackages',
    'arrivalDate',
  ],

  /** Fields compared between an ingested document and the canonical shipment record (mismatch rule). */
  MISMATCH_FIELDS: [
    'invoiceNumber',
    'invoiceValue',
    'currency',
    'hsCode',
    'countryOfOrigin',
    'grossWeightKg',
    'netWeightKg',
    'numberOfPackages',
    'containerNumber',
    'billOfLading',
  ],
} as const;

export type Config = typeof config;
