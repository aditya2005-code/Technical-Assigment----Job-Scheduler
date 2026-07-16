/**
 * workers/worker.js — Single worker unit
 *
 * WHY this is separate from workerService: WorkerService owns the
 * polling loop and lifecycle. This module owns a single iteration:
 * fetch → lock → execute → update. Separating them makes each
 * piece unit-testable in isolation.
 *
 * WHY we check the lock result after fetching: getNextPendingJob()
 * and lockJob() are two separate operations (not one atomic query)
 * so there is a window where another worker could claim the job
 * between the SELECT and the UPDATE. Checking lockJob()'s return
 * value handles that race without retrying — we simply skip and let
 * the loop pick up the next available job.
 */

import * as jobRepository from '../repositories/jobRepository.js';
import * as lockService    from '../services/lockService.js';
import * as retryService   from '../services/retryService.js';
import { execute }         from './executor.js';

/**
 * Processes a single pending job end-to-end.
 *
 * Steps:
 *  1. Fetch the oldest pending job.
 *  2. Attempt to lock it (atomic compare-and-swap).
 *  3. Execute its shell command.
 *  4. Update state to completed or failed.
 *
 * @returns {Promise<boolean>} true if a job was found and processed,
 *                             false if the queue was empty.
 */
export async function processNextJob() {
  // 1. Peek at the oldest pending job.
  const job = jobRepository.getNextPendingJob();

  if (!job) {
    return false; // Queue is empty — caller will sleep and retry
  }

  // 2. Atomically claim the job. Returns false if another worker
  //    already grabbed it between our SELECT and this UPDATE.
  const locked = lockService.lockJob(job.id);
  if (!locked) {
    // Lost the race — skip silently; the loop will try again shortly.
    return false;
  }

  console.log(`⚙  Processing job ${job.id}...`);

  // 3. Execute the shell command captured in the job.
  const result = await execute(job.command);

  // 4. Persist the outcome.
  if (result.success) {
    jobRepository.markCompleted(job.id);
    console.log(`✓ Job ${job.id} completed.`);
    if (result.stdout) console.log(`   stdout: ${result.stdout}`);
  } else {
    console.error(`✗ Job ${job.id} failed (exit ${result.exitCode}).`);
    if (result.stderr) console.error(`   stderr: ${result.stderr}`);
    
    // Delegate to retryService to check retries, increment attempts,
    // and schedule backoff if allowed.
    retryService.handleFailure(job);
  }

  lockService.unlockJob(job.id); // no-op today; keeps the contract intact

  return true; // A job was processed
}
