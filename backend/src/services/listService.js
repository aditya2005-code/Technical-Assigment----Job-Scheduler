/**
 * listService.js — Job listing and validation service
 *
 * WHY this service exists:
 * It owns state-filter validation and decides which repository queries to execute.
 * Decoupling this from the command handler ensures that state validation rules
 * can be reused by other interfaces (e.g. APIs or Web interfaces) without duplication.
 */

import * as jobRepository from '../repositories/jobRepository.js';
import { JOB_STATE }       from '../utils/constants.js';

const ALLOWED_STATES = new Set(Object.values(JOB_STATE));

/**
 * Lists jobs, optionally filtered by state.
 *
 * @param {string} [state] - Optional state filter.
 * @returns {Job[]} List of matched jobs.
 * @throws {Error} If state filter is invalid.
 */
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
