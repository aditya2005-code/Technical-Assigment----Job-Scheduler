export const JOB_STATE = Object.freeze({
  PENDING:    'pending',
  PROCESSING: 'processing',
  RUNNING:    'processing',
  COMPLETED:  'completed',
  FAILED:     'failed',
  DEAD:       'dead',
});

export const WORKER = Object.freeze({
  POLL_INTERVAL_MS: 1000,
});

export const JOB_DEFAULTS = Object.freeze({
  STATE:       JOB_STATE.PENDING,
  ATTEMPTS:    0,
  MAX_RETRIES: 3,
});
