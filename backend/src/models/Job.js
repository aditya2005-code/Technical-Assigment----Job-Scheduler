/**
 * Job.js — Domain model for a queue job
 *
 * WHY a class instead of a plain object: A class gives us a named,
 * inspectable type, makes instanceof checks possible in future
 * layers, and provides a single place to add computed properties
 * (e.g. isRetryable) without scattering logic across the codebase.
 *
 * WHY no ORM: better-sqlite3 is fast and synchronous. Introducing
 * an ORM for a CLI tool adds weight and async complexity with no
 * benefit. The repository layer handles all SQL explicitly.
 */

export class Job {
  /**
   * @param {object} params
   * @param {string} params.id          - Unique job identifier (caller-supplied)
   * @param {string} params.command     - Shell command or task descriptor
   * @param {string} params.state       - Lifecycle state (see constants.JOB_STATE)
   * @param {number} params.attempts    - Number of execution attempts so far
   * @param {number} params.max_retries - Maximum allowed retry attempts
   * @param {string} params.created_at  - ISO-8601 creation timestamp
   * @param {string} params.updated_at  - ISO-8601 last-updated timestamp
   */
  constructor({ id, command, state, attempts, max_retries, created_at, updated_at }) {
    this.id          = id;
    this.command     = command;
    this.state       = state;
    this.attempts    = attempts;
    this.max_retries = max_retries;
    this.created_at  = created_at;
    this.updated_at  = updated_at;
  }
}
