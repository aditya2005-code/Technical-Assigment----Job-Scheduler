/**
 * dlqService.js — Dead Letter Queue business logic
 *
 * WHY this service exists:
 * The DLQ service isolates lifecycle transitions for jobs that have either
 * exhausted their automated retries or require manual retry intervention.
 * It enforces business validations (e.g. checking that only dead jobs are
 * retried, preventing completed jobs from moving to DLQ) and throws clean,
 * descriptive error messages that the command layer can display to the user.
 */

import * as jobRepository from '../repositories/jobRepository.js';

/**
 * Returns list of all dead jobs.
 *
 * @returns {object[]}
 */
export function listDeadJobs() {
  return jobRepository.findDeadJobs();
}

/**
 * Manually retries a job that resides in the Dead Letter Queue.
 *
 * Validation checks:
 *   - The job must exist in SQLite.
 *   - The job's current state must be exactly 'dead'.
 *
 * @param {string} jobId
 * @throws {Error} If job is missing or not in DLQ.
 */
export function retryDeadJob(jobId) {
  const job = jobRepository.findById(jobId);

  if (!job) {
    throw new Error(`Job "${jobId}" not found.`);
  }

  if (job.state !== 'dead') {
    throw new Error('Job is not in DLQ.');
  }

  jobRepository.resetDeadJob(jobId);
}

/**
 * Permanently moves a job into the Dead Letter Queue.
 *
 * Validation checks:
 *   - The job must exist in SQLite.
 *   - Cannot move a job that has already completed successfully.
 *
 * @param {string} jobId
 * @throws {Error} If job is completed or missing.
 */
export function moveToDead(jobId) {
  const job = jobRepository.findById(jobId);

  if (!job) {
    throw new Error(`Job "${jobId}" not found.`);
  }

  if (job.state === 'completed') {
    throw new Error('Cannot move completed jobs into DLQ.');
  }

  jobRepository.moveToDead(jobId);
}
