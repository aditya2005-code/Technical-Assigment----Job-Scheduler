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
 *
 * @param {object} options - Command options parsed by Commander.
 */
export async function workerStartAction(options) {
  const count = parseInt(options.count, 10);

  if (isNaN(count) || count <= 0) {
    console.error('✗ Worker count must be a positive integer.');
    process.exit(1);
  }

  try {
    await workerService.start(count);
  } catch (err) {
    console.error(`✗ Worker failed to start: ${err.message}`);
    process.exit(1);
  }
}
