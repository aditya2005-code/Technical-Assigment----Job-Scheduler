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
  PENDING:    'pending',
  PROCESSING: 'processing', // actively being executed by a worker
  RUNNING:    'processing', // alias kept for forward compatibility
  COMPLETED:  'completed',
  FAILED:     'failed',
  DEAD:       'dead',       // moved to DLQ (Part 3)
});

// ── Worker settings ───────────────────────────────────────────────
export const WORKER = Object.freeze({
  POLL_INTERVAL_MS: 1000, // how long to sleep when the queue is empty
});

// ── Job defaults ──────────────────────────────────────────────────
export const JOB_DEFAULTS = Object.freeze({
  STATE:       JOB_STATE.PENDING,
  ATTEMPTS:    0,
  MAX_RETRIES: 3,
});
