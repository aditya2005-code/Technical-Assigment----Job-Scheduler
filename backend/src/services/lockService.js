/**
 * lockService.js — Optimistic job locking
 *
 * WHY this service exists: Even with a single worker today, the
 * locking contract needs to exist at the service layer so that adding
 * multiple workers in Part 4 requires zero changes to the caller
 * (workerService). The lock strategy lives here, not scattered in
 * the worker loop.
 *
 * Strategy: Optimistic locking via atomic SQL UPDATE.
 * We do NOT use a separate locks table or an in-memory Map because:
 *   - A separate table adds joins and round-trips.
 *   - An in-memory Map breaks when multiple OS processes run.
 *   - The state column itself IS the lock. Only the process that
 *     successfully flips state from 'pending' → 'processing' wins.
 *
 * This is safe in SQLite because WAL mode + serialized writes mean
 * two concurrent UPDATEs for the same row are automatically
 * serialized by the database engine.
 */

import * as jobRepository from '../repositories/jobRepository.js';

/**
 * Attempts to exclusively claim a pending job for processing.
 *
 * @param {string} jobId - The id of the job to lock.
 * @returns {boolean} true if this caller successfully acquired the
 *                    lock; false if another worker got there first.
 */
export function lockJob(jobId) {
  // markProcessing performs the compare-and-swap at the DB level.
  // Returns true only if exactly one row was updated (i.e. the job
  // was still in 'pending' state when the UPDATE ran).
  return jobRepository.markProcessing(jobId);
}

/**
 * Releases a job lock by marking the job as completed or failed.
 * In this implementation the "unlock" is implicit — the state
 * transition itself (completed/failed) serves as the unlock signal.
 *
 * This function is a no-op placeholder kept for API symmetry with
 * lockJob(). Future implementations (e.g. heartbeat-based locks
 * with a TTL) would add real logic here.
 *
 * @param {string} _jobId - Unused; kept for interface symmetry.
 */
export function unlockJob(_jobId) {
  // Intentional no-op: the job's final state (completed | failed)
  // already acts as the unlock signal. No separate action required.
}
