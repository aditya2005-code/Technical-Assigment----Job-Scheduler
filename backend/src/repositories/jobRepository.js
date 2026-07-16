/**
 * jobRepository.js — Data access layer for the jobs table
 *
 * WHY this layer exists: Keeping all SQL in one place means the rest
 * of the application is completely decoupled from the storage engine.
 * If we ever swap SQLite for PostgreSQL, only this file changes.
 *
 * WHY synchronous statements (better-sqlite3): The CLI is single-
 * process, single-command. There is nothing to interleave with while
 * the DB is doing its work, so sync I/O is both simpler and faster
 * than async here.
 *
 * Contract: every method either returns a value or throws. There is
 * NO console output from this layer — that responsibility belongs to
 * the command layer.
 */

import db from '../database/database.js';
import { Job } from '../models/Job.js';

/**
 * Persists a new Job to the database.
 *
 * @param {Job} job
 * @returns {Job} The same job instance (useful for chaining in tests).
 * @throws {Error} 'Job ID already exists.' if the id is a duplicate.
 */
export function create(job) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
    VALUES (@id, @command, @state, @attempts, @max_retries, @created_at, @updated_at)
  `);

  try {
    // better-sqlite3 named params require a plain object.
    // Spreading strips the Job class prototype while keeping all
    // enumerable properties intact.
    stmt.run({ ...job });
  } catch (err) {
    // SQLite throws a generic Error whose message contains
    // 'UNIQUE constraint failed' on duplicate primary keys.
    // We surface a clean, user-friendly message instead.
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Job ID already exists.`);
    }
    throw err; // Re-throw unexpected DB errors unchanged
  }

  return job;
}

/**
 * Retrieves a single job by its primary key.
 *
 * @param {string} id
 * @returns {Job|null} The job, or null if not found.
 */
export function findById(id) {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return row ? new Job(row) : null;
}

/**
 * Returns all jobs ordered by creation time (oldest first).
 *
 * @returns {Job[]}
 */
export function list() {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all();
  return rows.map((row) => new Job(row));
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker methods — added in Part 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the oldest pending job without claiming it.
 * The caller (lockService) is responsible for atomically claiming it
 * via markProcessing() immediately after.
 *
 * @returns {Job|null}
 */
export function getNextPendingJob() {
  const row = db
    .prepare("SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1")
    .get();
  return row ? new Job(row) : null;
}

/**
 * Atomically transitions a job from pending → processing.
 *
 * WHY WHERE state = 'pending': This is the compare-and-swap guard.
 * If two workers race for the same job, only the one that executes
 * this UPDATE first will get changes = 1. The second will see
 * changes = 0 and must skip the job, preventing double-execution.
 *
 * @param {string} id
 * @returns {boolean} true if the lock was acquired, false if another
 *                    worker already claimed it.
 */
export function markProcessing(id) {
  const now  = new Date().toISOString();
  const info = db
    .prepare("UPDATE jobs SET state = 'processing', updated_at = ? WHERE id = ? AND state = 'pending'")
    .run(now, id);
  // info.changes is the number of rows actually modified.
  return info.changes === 1;
}

/**
 * Marks a job as successfully completed.
 *
 * @param {string} id
 */
export function markCompleted(id) {
  const now = new Date().toISOString();
  db.prepare("UPDATE jobs SET state = 'completed', updated_at = ? WHERE id = ?").run(now, id);
}

/**
 * Marks a job as failed. Increments the attempts counter and returns the new count.
 *
 * @param {string} id
 * @returns {number} The updated attempts count.
 */
export function markFailed(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'failed', attempts = attempts + 1, updated_at = ? WHERE id = ?"
  ).run(now, id);

  const row = db.prepare("SELECT attempts FROM jobs WHERE id = ?").get(id);
  return row ? row.attempts : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry repository methods — added in Part 3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Increments the attempt count for a job and returns the new count.
 *
 * @param {string} id
 * @returns {number} The updated attempts count.
 */
export function incrementAttempts(id) {
  const now = new Date().toISOString();
  // Increment attempt counter in the database
  db.prepare("UPDATE jobs SET attempts = attempts + 1, updated_at = ? WHERE id = ?").run(now, id);

  // Retrieve the updated count to return to the service layer
  const row = db.prepare("SELECT attempts FROM jobs WHERE id = ?").get(id);
  return row ? row.attempts : 0;
}

/**
 * Schedules a retry for a job by updating its state and next_retry_at timestamp.
 *
 * @param {string} id
 * @param {string} nextRetryAt - ISO-8601 timestamp of when to retry the job.
 */
export function scheduleRetry(id, nextRetryAt) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'failed', next_retry_at = ?, updated_at = ? WHERE id = ?"
  ).run(nextRetryAt, now, id);
}

/**
 * Finds all jobs currently in 'failed' state whose scheduled retry time has passed.
 *
 * @param {string} now - Current ISO-8601 timestamp.
 * @returns {Job[]} List of jobs ready to be retried.
 */
export function findRetryableJobs(now) {
  const rows = db
    .prepare("SELECT * FROM jobs WHERE state = 'failed' AND next_retry_at <= ? ORDER BY next_retry_at ASC")
    .all(now);
  return rows.map((row) => new Job(row));
}

/**
 * Resets a job back to 'pending' state so it can be picked up by workers.
 *
 * @param {string} id
 */
export function resetToPending(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'pending', next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

// ─────────────────────────────────────────────────────────────────────────────
// DLQ repository methods — added in Part 4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all jobs in 'dead' state.
 *
 * @returns {Job[]}
 */
export function findDeadJobs() {
  const rows = db.prepare("SELECT * FROM jobs WHERE state = 'dead' ORDER BY updated_at ASC").all();
  return rows.map((row) => new Job(row));
}

/**
 * Transition a job to 'dead' state and reset next_retry_at.
 *
 * @param {string} id
 */
export function moveToDead(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'dead', next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

/**
 * Reset attempts to 0, state to pending, and clear next_retry_at for manual DLQ retry.
 *
 * @param {string} id
 */
export function resetDeadJob(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'pending', attempts = 0, next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

/**
 * Find a job by id but only if its state is 'dead'.
 *
 * @param {string} id
 * @returns {Job|null}
 */
export function findDeadJobById(id) {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ? AND state = 'dead'").get(id);
  return row ? new Job(row) : null;
}


