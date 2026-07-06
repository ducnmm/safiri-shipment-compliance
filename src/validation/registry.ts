import { arrivalWindowRule } from './rules/arrivalWindow.js';
import { billOfLadingRule } from './rules/billOfLading.js';
import { containerNumberRule } from './rules/containerNumber.js';
import { countryOfOriginRule } from './rules/countryOfOrigin.js';
import { documentMismatchRule } from './rules/documentMismatch.js';
import { duplicateReferenceRule } from './rules/duplicateReference.js';
import { hsCodeFormatRule } from './rules/hsCodeFormat.js';
import { invoiceValueRule } from './rules/invoiceValue.js';
import { requiredFieldsRule } from './rules/requiredFields.js';
import { weightConsistencyRule } from './rules/weightConsistency.js';
import { woodPackagingRule } from './rules/woodPackaging.js';
import type { Rule } from './types.js';

/**
 * The ordered registry of validation rules. Adding a rule is a one-line change
 * here plus a new file under rules/ — the engine and everything downstream pick
 * it up automatically. Output order does not matter; the engine sorts by severity.
 */
export const rules: Rule[] = [
  requiredFieldsRule,
  hsCodeFormatRule,
  countryOfOriginRule,
  weightConsistencyRule,
  billOfLadingRule,
  containerNumberRule,
  invoiceValueRule,
  woodPackagingRule,
  arrivalWindowRule,
  duplicateReferenceRule,
  documentMismatchRule,
];
