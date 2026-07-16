import { parseJSON, validateJobPayload } from '../utils/validator.js';
import { JOB_DEFAULTS } from '../utils/constants.js';
import { Job } from '../models/Job.js';
import * as jobRepository from '../repositories/jobRepository.js';

export function enqueue(rawJson) {

  const payload = parseJSON(rawJson);

  validateJobPayload(payload);

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

  return jobRepository.create(job);
}
