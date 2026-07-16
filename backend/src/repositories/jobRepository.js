import db from '../database/database.js';
import { Job } from '../models/Job.js';

export function create(job) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
    VALUES (@id, @command, @state, @attempts, @max_retries, @created_at, @updated_at)
  `);

  try {

    stmt.run({ ...job });
  } catch (err) {

    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Job ID already exists.`);
    }
    throw err;
  }

  return job;
}

export function findById(id) {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return row ? new Job(row) : null;
}

export function list() {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all();
  return rows.map((row) => new Job(row));
}

export function getNextPendingJob() {
  const row = db
    .prepare("SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1")
    .get();
  return row ? new Job(row) : null;
}

export function markProcessing(id) {
  const now  = new Date().toISOString();
  const info = db
    .prepare("UPDATE jobs SET state = 'processing', updated_at = ? WHERE id = ? AND state = 'pending'")
    .run(now, id);

  return info.changes === 1;
}

export function markCompleted(id) {
  const now = new Date().toISOString();
  db.prepare("UPDATE jobs SET state = 'completed', updated_at = ? WHERE id = ?").run(now, id);
}

export function markFailed(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'failed', attempts = attempts + 1, updated_at = ? WHERE id = ?"
  ).run(now, id);

  const row = db.prepare("SELECT attempts FROM jobs WHERE id = ?").get(id);
  return row ? row.attempts : 0;
}

export function incrementAttempts(id) {
  const now = new Date().toISOString();

  db.prepare("UPDATE jobs SET attempts = attempts + 1, updated_at = ? WHERE id = ?").run(now, id);

  const row = db.prepare("SELECT attempts FROM jobs WHERE id = ?").get(id);
  return row ? row.attempts : 0;
}

export function scheduleRetry(id, nextRetryAt) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'failed', next_retry_at = ?, updated_at = ? WHERE id = ?"
  ).run(nextRetryAt, now, id);
}

export function findRetryableJobs(now) {
  const rows = db
    .prepare("SELECT * FROM jobs WHERE state = 'failed' AND next_retry_at <= ? ORDER BY next_retry_at ASC")
    .all(now);
  return rows.map((row) => new Job(row));
}

export function resetToPending(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'pending', next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

export function findDeadJobs() {
  const rows = db.prepare("SELECT * FROM jobs WHERE state = 'dead' ORDER BY updated_at ASC").all();
  return rows.map((row) => new Job(row));
}

export function moveToDead(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'dead', next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

export function resetDeadJob(id) {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET state = 'pending', attempts = 0, next_retry_at = NULL, updated_at = ? WHERE id = ?"
  ).run(now, id);
}

export function findDeadJobById(id) {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ? AND state = 'dead'").get(id);
  return row ? new Job(row) : null;
}

export function countByState() {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN state = 'processing' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN state = 'dead' THEN 1 ELSE 0 END) AS dead
    FROM jobs
  `).get();

  return {
    pending:    row.pending || 0,
    processing: row.processing || 0,
    completed:  row.completed || 0,
    failed:     row.failed || 0,
    dead:       row.dead || 0,
  };
}

export function countAllJobs() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM jobs').get();
  return row ? row.total : 0;
}

export function findJobs() {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  return rows.map((row) => new Job(row));
}

export function findJobsByState(state) {
  const rows = db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC').all(state);
  return rows.map((row) => new Job(row));
}
