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
 * Marks a job as failed. Increments the attempts counter so future
 * retry/DLQ logic (Part 3) has accurate data to work with.
 *
 * @param {string} id
 */
export function markFailed(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'failed', attempts = attempts + 1, updated_at = ? WHERE id = ?"
  ).run(now, id);
}
