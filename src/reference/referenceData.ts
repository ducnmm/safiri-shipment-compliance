import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads snapshotted reference-code lists (ISO 3166 countries, ISO 4217
 * currencies, WCO HS chapters) into fast-lookup Sets. These are MOCKED local
 * snapshots, not live feeds — see README for sources and refresh cadence.
 */
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

function loadCodes(file: string): string[] {
  const raw = readFileSync(join(dataDir, file), 'utf8');
  const parsed = JSON.parse(raw) as { codes: string[] };
  return parsed.codes;
}

/** USD exchange-rate snapshot: currency code -> USD worth of one unit. */
function loadRates(file: string): Record<string, number> {
  const raw = readFileSync(join(dataDir, file), 'utf8');
  const parsed = JSON.parse(raw) as { rates: Record<string, number> };
  return parsed.rates;
}

export interface ReferenceData {
  countries: Set<string>;
  currencies: Set<string>;
  hsChapters: Set<string>;
  /** currency code -> USD per unit; used to normalise invoice values before the plausibility check. */
  fxRatesUsd: Record<string, number>;
}

export const referenceData: ReferenceData = {
  countries: new Set(loadCodes('iso-3166-alpha2.json')),
  currencies: new Set(loadCodes('iso-4217-currencies.json')),
  hsChapters: new Set(loadCodes('hs-chapters.json')),
  fxRatesUsd: loadRates('fx-usd-rates.json'),
};
