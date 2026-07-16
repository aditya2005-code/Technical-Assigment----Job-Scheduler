/**
 * workerService.js — Worker lifecycle and polling loop
 *
 * WHY the polling loop lives here instead of in worker.js:
 * WorkerService owns the big picture (start, stop, interval).
 * workers/worker.js owns the per-job micro-steps. Separating them
 * means we can test each piece independently and swap the polling
 * strategy (e.g. to event-driven pub/sub) without touching job
 * processing logic.
 *
 * WHY setImmediate + recursive scheduling instead of setInterval:
 * setInterval fires on a fixed wall-clock cadence regardless of how
 * long the previous tick took. If a job runs for 2 s and the
 * interval is 1 s, setInterval queues a backlog of ticks.
 * Recursive setTimeout/setImmediate only schedules the NEXT tick
 * after the current one finishes, so we never build up a backlog.
 *
 * WHY the sleep is only triggered when the queue is empty:
 * When there ARE pending jobs we want to process them as fast as
 * possible with no artificial delay between iterations.
 */

import { processNextJob }          from '../workers/worker.js';
import { isShuttingDown,
         registerShutdownHandlers } from '../workers/shutdown.js';
import { WORKER }                  from '../utils/constants.js';

/**
 * Sleeps for the configured polling interval.
 * Returns a Promise so the async loop can await it without blocking
 * the event loop (which would prevent signal handlers from firing).
 *
 * @returns {Promise<void>}
 */
function sleep() {
  return new Promise((resolve) => setTimeout(resolve, WORKER.POLL_INTERVAL_MS));
}

/**
 * Starts the worker polling loop.
 *
 * The loop runs until a shutdown signal is received. When the queue
 * is empty it sleeps for POLL_INTERVAL_MS before checking again.
 * When jobs are present it processes them back-to-back with no delay.
 */
export async function start() {
  // Register OS signal handlers before entering the loop so Ctrl+C
  // is handled from the very first iteration.
  registerShutdownHandlers();

  console.log('Worker started...');

  while (!isShuttingDown()) {
    try {
      const didWork = await processNextJob();

      if (!didWork) {
        // Queue was empty — log once then sleep to avoid busy-waiting.
        console.log('Waiting for jobs...');
        await sleep();
      }
      // If we did work, loop immediately to pick up the next job.
    } catch (err) {
      // A completely unexpected error (e.g. DB connection lost).
      // Log it but do NOT crash the worker — stay alive and retry.
      console.error('Unexpected worker error:', err.message);
      await sleep(); // Back off before retrying to avoid error storms
    }
  }

  console.log('Worker shut down gracefully.');
  process.exit(0);
}
