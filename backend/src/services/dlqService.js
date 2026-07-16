import * as jobRepository from '../repositories/jobRepository.js';

export function listDeadJobs() {
  return jobRepository.findDeadJobs();
}

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
