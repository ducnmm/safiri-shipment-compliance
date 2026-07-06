/** A value counts as "missing" if it is null/undefined or a blank string. Numeric 0 is NOT missing. */
export function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** Strip separators (dots, spaces, dashes) from an HS code for format checks. */
export function normalizeHsCode(code: string): string {
  return code.replace(/[\s.\-]/g, '');
}

/**
 * Loose value equality for reconciling document values against the canonical
 * shipment record. Date-aware (compare instants, since mapped values may arrive
 * as ISO strings after a JSON round-trip), numeric-aware (compare as numbers),
 * otherwise a trimmed case-insensitive string compare. This is the single
 * definition shared by document ingestion (conflict detection) and the mismatch
 * rule, so the two can never diverge.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const da = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const db = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return da === db;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
