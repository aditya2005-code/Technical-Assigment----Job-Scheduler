/**
 * workerService.js — Worker lifecycle delegation
 *
 * WHY this service exists:
 * It bridges the CLI command handler and the WorkerManager. Rather than
 * managing process orchestration directly in index.js, this service wraps
 * the manager and handles future concurrency configurations.
 */

import * as workerManager from '../workers/workerManager.js';

/**
 * Starts the worker processes via WorkerManager.
 *
 * @param {number} count - Number of concurrent workers to start.
 */
export async function start(count = 1) {
  await workerManager.start(count);
}

