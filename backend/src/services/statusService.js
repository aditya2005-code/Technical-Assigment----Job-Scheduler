import * as jobRepository from '../repositories/jobRepository.js';
import * as workerManager from '../workers/workerManager.js';

export function getQueueStatus() {
  const counts = jobRepository.countByState();
  const totalJobs = jobRepository.countAllJobs();

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
