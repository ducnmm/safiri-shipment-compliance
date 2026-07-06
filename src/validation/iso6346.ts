/**
 * ISO 6346 container-number validation (owner code + equipment category +
 * 6-digit serial + 1 check digit), e.g. "CSQU3054383".
 *
 * The check digit is computed from the first 10 characters:
 *   - each letter maps to a value (A=10..Z=38, skipping multiples of 11),
 *   - each digit is its face value,
 *   - sum = Σ value(char_i) * 2^i for i = 0..9,
 *   - check digit = (sum mod 11) mod 10.
 *
 * Verified by hand against the published example CSQU3054383 (check digit 3).
 */

const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

export const CONTAINER_FORMAT = /^[A-Z]{3}[UJZ]\d{7}$/;

/** Compute the ISO 6346 check digit from the first 10 characters (4 letters + 6 digits). */
export function computeCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = first10.charAt(i);
    const value = ch >= '0' && ch <= '9' ? Number(ch) : LETTER_VALUES[ch];
    if (value === undefined) {
      throw new Error(`Invalid container character: ${ch}`);
    }
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

export type ContainerCheck = { valid: true } | { valid: false; reason: 'format' | 'check_digit' };

/** Validate a container number's format and check digit. */
export function checkContainerNumber(raw: string): ContainerCheck {
  const normalized = raw.trim().toUpperCase().replace(/\s/g, '');
  if (!CONTAINER_FORMAT.test(normalized)) {
    return { valid: false, reason: 'format' };
  }
  const expected = Number(normalized.charAt(10));
  const computed = computeCheckDigit(normalized.slice(0, 10));
  return computed === expected ? { valid: true } : { valid: false, reason: 'check_digit' };
}
