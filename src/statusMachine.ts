import { TERMINAL_STATUSES, type Severity, type ShipmentStatus } from './types.js';

/**
 * Derive a shipment's status from its validation issues:
 *   - any critical issue  -> blocked (hard stop),
 *   - any high/medium      -> requires_review,
 *   - otherwise (low/none)  -> ready.
 */
export function deriveStatus(issues: Array<{ severity: Severity }>): ShipmentStatus {
  if (issues.some((i) => i.severity === 'critical')) return 'blocked';
  if (issues.some((i) => i.severity === 'high' || i.severity === 'medium')) return 'requires_review';
  return 'ready';
}

export function isTerminal(status: ShipmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Statuses a human reviewer may act on, and the decisions they may record. */
const MANUAL_FROM: ShipmentStatus[] = ['ready', 'requires_review'];
const MANUAL_TO: ShipmentStatus[] = ['approved', 'rejected'];

/** Whether a manual (PATCH) status change is allowed. */
export function canManuallyTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return MANUAL_FROM.includes(from) && MANUAL_TO.includes(to);
}

/** Valid target statuses for a manual decision, for error messages. */
export const MANUAL_TARGETS = MANUAL_TO;
