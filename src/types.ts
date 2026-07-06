/** Domain-wide shared types (enums modelled as string unions because SQLite has no native enum). */

export const SHIPMENT_STATUSES = [
  'draft',
  'documents_ingested',
  'blocked',
  'requires_review',
  'ready',
  'approved',
  'rejected',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Statuses from which no further automated transition is allowed. */
export const TERMINAL_STATUSES: ShipmentStatus[] = ['approved', 'rejected'];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Rank used to sort issues (critical first) and to derive shipment status. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * A plain snapshot of the shipment fields the validation engine reads.
 * Decoupling this from the Prisma model keeps rules pure and trivially
 * testable — a test constructs a snapshot by hand, no database required.
 */
export interface ShipmentSnapshot {
  id: string;
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
  status: ShipmentStatus;
}
