/**
 * commands/worker.js — CLI command handler for "worker"
 *
 * Responsibilities:
 *   - Register the "worker start" sub-command with Commander.
 *   - Delegate to WorkerService.start().
 *   - Print errors if the service throws during startup.
 *
 * Does NOT contain: polling logic, SQL, job execution, signal handling.
 * All of that belongs in the service and worker layers below.
 */

import * as workerService from '../services/workerService.js';

/**
 * Action handler for `queuectl worker start`.
 * WorkerService.start() is async and runs indefinitely (the polling
 * loop). We await it here so that unhandled rejections are caught
 * and surfaced cleanly rather than crashing with an unhandled
 * promise rejection warning.
 */
export async function workerStartAction() {
  try {
    await workerService.start();
  } catch (err) {
    console.error(`✗ Worker failed to start: ${err.message}`);
    process.exit(1);
  }
}
