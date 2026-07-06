import type { Config } from '../config.js';
import type { Severity, ShipmentSnapshot } from '../types.js';

export type { Severity, ShipmentSnapshot } from '../types.js';

/** A single issue produced by a rule (before it is persisted). */
export interface IssueDraft {
  ruleCode: string;
  issueType: string;
  severity: Severity;
  field: string | null;
  explanation: string;
  suggestedAction: string;
}

/** The document view a rule sees: just an id and the mapped (camelCase) fields. */
export interface DocumentView {
  id: string;
  mappedFields: Record<string, unknown>;
}

/**
 * Everything a rule needs beyond the shipment itself. All IO (duplicate counts,
 * documents, reference sets, current time) is pre-fetched by the validation
 * service so that rules stay pure and synchronous — trivial to unit-test.
 */
export interface ValidationContext {
  now: Date;
  countries: Set<string>;
  currencies: Set<string>;
  hsChapters: Set<string>;
  duplicateReferenceCount: number;
  documents: DocumentView[];
  config: Config;
}

/** A validation rule. `code` identifies the rule; individual issues carry their own ruleCode. */
export interface Rule {
  code: string;
  description: string;
  check(shipment: ShipmentSnapshot, ctx: ValidationContext): IssueDraft[];
}
