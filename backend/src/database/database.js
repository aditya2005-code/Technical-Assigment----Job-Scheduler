/**
 * database.js — SQLite connection singleton
 *
 * WHY a singleton: better-sqlite3 connections are synchronous and
 * inexpensive to hold open. A singleton prevents multiple processes
 * from opening competing write connections to the same file, which
 * would cause SQLITE_BUSY errors under the CLI workload.
 *
 * WHY we run schema.sql at startup: This is a CLI tool, not a
 * long-lived server, so we cannot assume migrations have been run
 * separately. Running CREATE TABLE IF NOT EXISTS on every invocation
 * is safe, idempotent, and removes the need for a separate
 * migration step.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Resolve the directory of THIS file so the paths work regardless
// of the cwd from which the CLI is invoked.
const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH    = join(__dirname, '..', '..', 'queue.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

// Open (or create) the database file.
// { verbose: null } — we do not pipe SQLite's internal logging to
// stdout because CLI output must stay clean for the user.
const db = new Database(DB_PATH);

// Enforce foreign-key constraints (good hygiene; future tables may
// reference jobs by id).
db.pragma('journal_mode = WAL');   // Write-Ahead Logging for concurrency
db.pragma('foreign_keys = ON');

// Bootstrap the schema on every cold start. CREATE TABLE IF NOT
// EXISTS makes this a no-op when the table already exists.
const schema = readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Migration: Safely add next_retry_at column to jobs table if it was
// created in Part 1 or Part 2.
try {
  db.prepare('ALTER TABLE jobs ADD COLUMN next_retry_at TEXT NULL').run();
} catch (err) {
  // If the column already exists, SQLite will throw an error:
  // "duplicate column name: next_retry_at". We ignore this safely.
  if (!err.message.includes('duplicate column name')) {
    throw err;
  }
}

export default db;
