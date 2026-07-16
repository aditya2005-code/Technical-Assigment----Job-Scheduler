/**
 * retryService.js — Automated job retrying business logic
 *
 * WHY services over repositories:
 * All calculations for delay (exponential backoff), timestamp formatting,
 * configuration fallbacks, and execution logic orchestration reside here.
 * The repository stays pure: it only accepts parameters and runs queries.
 */

import { calculateBackoffDelay } from '../utils/backoff.js';
import * as jobRepository from '../repositories/jobRepository.js';
import * as dlqService   from './dlqService.js';
import * as configService from './configService.js';

/**
 * Handles a job failure by incrementing its attempt count and scheduling
 * a retry with exponential backoff if the limit is not exceeded.
 *
 * @param {object} job - The job instance that failed.
 * @returns {boolean} True if a retry was successfully scheduled, false if retries exhausted.
 */
export function handleFailure(job) {
  // 1. Mark failed and increment attempts in the database.
  // We get the updated attempts count back to make decisions.
  const newAttempts = jobRepository.markFailed(job.id);

  // 2. Check if attempts exceed the configured threshold.
  // Respect job-specific override if it differs from the schema default (3)
  const configMaxRetries = configService.getConfig('max-retries', 3);
  const maxRetries = (job.max_retries !== undefined && job.max_retries !== null && job.max_retries !== 3)
    ? job.max_retries
    : configMaxRetries;

  if (newAttempts <= maxRetries) {
    // Calculate exponential delay: delay = BACKOFF_BASE ^ attempts
    const backoffBase = configService.getConfig('backoff-base', 2);
    const delaySeconds = calculateBackoffDelay(newAttempts, backoffBase);
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    // Persist the retry state in SQLite
    jobRepository.scheduleRetry(job.id, nextRetryAt);

    console.log(`Retry scheduled in ${delaySeconds} seconds.`);
    return true;
  } else {
    console.log('Retries exhausted.');
    // Move job directly to Dead Letter Queue (DLQ) state
    try {
      dlqService.moveToDead(job.id);
      console.log(`Job ${job.id} moved to DLQ (state = 'dead').`);
    } catch (err) {
      console.error(`Failed to move job to DLQ: ${err.message}`);
    }
    return false;
  }
}

/**
 * Scans the database for failed jobs that have reached their scheduled retry time,
 * and resets them back to 'pending' state.
 *
 * @returns {number} The count of jobs successfully reset to pending.
 */
export function processScheduledRetries() {
  const now = new Date().toISOString();
  const retryableJobs = jobRepository.findRetryableJobs(now);

  for (const job of retryableJobs) {
    jobRepository.resetToPending(job.id);
    // Console log when a job is picked up by the scheduler
    console.log(`Scheduler: Job ${job.id} reset to pending.`);
  }

  return retryableJobs.length;
}
