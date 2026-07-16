import * as jobRepository from '../repositories/jobRepository.js';
import { JOB_STATE }       from '../utils/constants.js';

const ALLOWED_STATES = new Set(Object.values(JOB_STATE));

export function listJobs(state) {
  if (state) {
    const normalisedState = state.toLowerCase().trim();

    if (!ALLOWED_STATES.has(normalisedState)) {
      throw new Error('Invalid job state.');
    }

    return jobRepository.findJobsByState(normalisedState);
  }

  return jobRepository.findJobs();
}
