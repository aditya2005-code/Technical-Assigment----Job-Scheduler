/**
 * queueService.js — Business logic for job enqueuing
 *
 * WHY this layer exists: The service is the only place that knows
 * BOTH the shape of incoming data AND what the repository expects.
 * It owns all default-value assignment, timestamp generation, and
 * model instantiation — none of which belong in a command handler
 * (too high) or a repository (too low).
 *
 * WHY timestamps are set here and not in the DB: SQLite's CURRENT_TIMESTAMP
 * uses the server's local time in an unspecified format. Generating
 * ISO-8601 strings in JS gives us a consistent, timezone-aware
 * format that is portable and sortable.
 */

import { parseJSON, validateJobPayload } from '../utils/validator.js';
import { JOB_DEFAULTS } from '../utils/constants.js';
import { Job } from '../models/Job.js';
import * as jobRepository from '../repositories/jobRepository.js';

/**
 * Parses, validates, and persists a new job from a raw JSON string.
 *
 * @param {string} rawJson - The raw CLI argument string.
 * @returns {Job} The persisted Job instance.
 * @throws {Error} Validation or persistence errors with user-friendly messages.
 */
export function enqueue(rawJson) {
  // 1. Parse — throws on invalid JSON
  const payload = parseJSON(rawJson);

  // 2. Validate — throws on missing/invalid fields
  validateJobPayload(payload);

  // 3. Build the Job with all required defaults applied.
  //    The caller (CLI user) only needs to supply id + command;
  //    everything else has a sensible default.
  const now = new Date().toISOString();

  const job = new Job({
    id:          payload.id.trim(),
    command:     payload.command.trim(),
    state:       JOB_DEFAULTS.STATE,
    attempts:    JOB_DEFAULTS.ATTEMPTS,
    max_retries: JOB_DEFAULTS.MAX_RETRIES,
    created_at:  now,
    updated_at:  now,
  });

  // 4. Persist — throws on duplicate ID or DB error
  return jobRepository.create(job);
}
