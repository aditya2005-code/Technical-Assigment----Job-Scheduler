import * as jobRepository from '../repositories/jobRepository.js';

export function lockJob(jobId) {

  return jobRepository.markProcessing(jobId);
}

export function unlockJob(_jobId) {

}
