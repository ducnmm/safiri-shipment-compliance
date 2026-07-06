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

export interface ReferenceData {
  countries: Set<string>;
  currencies: Set<string>;
  hsChapters: Set<string>;
}

export const referenceData: ReferenceData = {
  countries: new Set(loadCodes('iso-3166-alpha2.json')),
  currencies: new Set(loadCodes('iso-4217-currencies.json')),
  hsChapters: new Set(loadCodes('hs-chapters.json')),
};
