/**
 * statusService.js — Status aggregation service
 *
 * WHY this service exists:
 * It separates status aggregation from both database storage (repository) and CLI
 * display (commands). It retrieves state-specific counts via the repository and
 * calls WorkerManager to get the current number of active workers.
 */

import * as jobRepository from '../repositories/jobRepository.js';
import * as workerManager from '../workers/workerManager.js';

/**
 * Aggregates stats about the queue and worker processes.
 *
 * @returns {object} Status stats object.
 */
export function getQueueStatus() {
  const counts = jobRepository.countByState();
  const totalJobs = jobRepository.countAllJobs();

  // Retrieve active worker count from WorkerManager.
  // Note: if the CLI command is executed standalone, getStatus().size will naturally return 0.
  const workerCount = workerManager.getStatus ? workerManager.getStatus().size : 0;

  return {
    pending:    counts.pending,
    processing: counts.processing,
    completed:  counts.completed,
    failed:     counts.failed,
    dead:       counts.dead,
    workers:    workerCount,
    totalJobs:  totalJobs,
  };
}
