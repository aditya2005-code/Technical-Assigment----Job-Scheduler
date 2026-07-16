import { calculateBackoffDelay } from '../utils/backoff.js';
import * as jobRepository from '../repositories/jobRepository.js';
import * as dlqService   from './dlqService.js';
import * as configService from './configService.js';

export function handleFailure(job) {

  const newAttempts = jobRepository.markFailed(job.id);

  const configMaxRetries = configService.getConfig('max-retries', 3);
  const maxRetries = (job.max_retries !== undefined && job.max_retries !== null && job.max_retries !== 3)
    ? job.max_retries
    : configMaxRetries;

  if (newAttempts <= maxRetries) {

    const backoffBase = configService.getConfig('backoff-base', 2);
    const delaySeconds = calculateBackoffDelay(newAttempts, backoffBase);
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    jobRepository.scheduleRetry(job.id, nextRetryAt);

    console.log(`Retry scheduled in ${delaySeconds} seconds.`);
    return true;
  } else {
    console.log('Retries exhausted.');

    try {
      dlqService.moveToDead(job.id);
      console.log(`Job ${job.id} moved to DLQ (state = 'dead').`);
    } catch (err) {
      console.error(`Failed to move job to DLQ: ${err.message}`);
    }
    return false;
  }
}

export function processScheduledRetries() {
  const now = new Date().toISOString();
  const retryableJobs = jobRepository.findRetryableJobs(now);

  for (const job of retryableJobs) {
    jobRepository.resetToPending(job.id);

    console.log(`Scheduler: Job ${job.id} reset to pending.`);
  }

  return retryableJobs.length;
}
