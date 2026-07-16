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
