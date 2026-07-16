/**
 * constants.js — Application-wide magic-string elimination
 *
 * WHY: Centralising literals here means every layer (service,
 * repository, validator) references the same value. A typo in one
 * place is caught immediately rather than silently producing wrong
 * behaviour at runtime.
 */

// ── Job states ────────────────────────────────────────────────────
// Only PENDING is used in Part 1. The others are declared now so
// future worker/retry code can import from a single source of truth.
export const JOB_STATE = Object.freeze({
  PENDING:   'pending',
  RUNNING:   'running',
  COMPLETED: 'completed',
  FAILED:    'failed',
  DEAD:      'dead',       // moved to DLQ
});

// ── Job defaults ──────────────────────────────────────────────────
export const JOB_DEFAULTS = Object.freeze({
  STATE:       JOB_STATE.PENDING,
  ATTEMPTS:    0,
  MAX_RETRIES: 3,
});
