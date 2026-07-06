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
