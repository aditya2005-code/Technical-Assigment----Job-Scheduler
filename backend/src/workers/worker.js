/**
 * workers/worker.js — Single worker unit and worker thread entrypoint
 *
 * WHY checks for isMainThread:
 * This file serves dual purposes:
 *   1. It is imported by other services to run or test job execution.
 *   2. It is launched directly as a Worker Thread entrypoint by WorkerManager.
 *      If running in a thread context, it automatically listens for signal/shutdown
 *      events from the parent and runs the polling loop.
 *
 * WHY parentPort message passing:
 * Communicates state transitions ('idle' / 'busy' with active jobId) back
 * to the parent thread to allow real-time monitoring and graceful exits.
 */

import { isMainThread, parentPort, workerData } from 'worker_threads';
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
 * @param {string} [workerId='Worker'] - The name/id of the current worker for logging.
 * @returns {Promise<boolean>} true if a job was found and processed,
 *                             false if the queue was empty.
 */
export async function processNextJob(workerId = 'Worker') {
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

  // Report status to parent thread if running inside a Worker Thread
  if (parentPort) {
    parentPort.postMessage({ type: 'status', status: 'busy', jobId: job.id });
  }

  console.log(`${workerId} processing job ${job.id}`);

  // 3. Execute the shell command captured in the job.
  const result = await execute(job.command);

  // 4. Persist the outcome.
  if (result.success) {
    jobRepository.markCompleted(job.id);
    console.log(`${workerId} completed job ${job.id}`);
    if (result.stdout) console.log(`   stdout: ${result.stdout}`);
  } else {
    console.error(`${workerId} failed job ${job.id}`);
    if (result.stderr) console.error(`   stderr: ${result.stderr}`);
    
    // Delegate to retryService to check retries, increment attempts,
    // and schedule backoff if allowed.
    retryService.handleFailure(job);
  }

  lockService.unlockJob(job.id); // no-op today; keeps the contract intact

  // Report status back to idle
  if (parentPort) {
    parentPort.postMessage({ type: 'status', status: 'idle', jobId: null });
  }

  return true; // A job was processed
}

/**
 * Main polling loop executed only when loaded inside a Worker Thread context.
 *
 * @param {string} workerId
 */
async function runWorkerLoop(workerId) {
  let shuttingDown = false;

  // Listen for graceful shutdown signals from the parent thread
  parentPort.on('message', (msg) => {
    if (msg.type === 'shutdown') {
      shuttingDown = true;
    }
  });

  // Report initial idle state
  parentPort.postMessage({ type: 'status', status: 'idle', jobId: null });

  while (!shuttingDown) {
    try {
      const didWork = await processNextJob(workerId);

      if (!didWork) {
        // Sleep for 1 second if queue is empty to avoid CPU busy-waiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`[${workerId}] Polling loop error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Graceful exit
  process.exit(0);
}

// Auto-run polling loop if invoked as a worker thread
if (!isMainThread) {
  const workerId = workerData?.id || 'Worker';
  runWorkerLoop(workerId);
}
