import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isTest = process.env.NODE_ENV === 'test';
const DB_FILE = isTest ? 'queue_test.db' : 'queue.db';
const DB_PATH = join(__dirname, '..', '..', DB_FILE);
const SCHEMA_PATH = join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

try {
  db.prepare('ALTER TABLE jobs ADD COLUMN next_retry_at TEXT NULL').run();
} catch (err) {

  if (!err.message.includes('duplicate column name')) {
    throw err;
  }
}

try {
  db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('max-retries', '3')").run();
  db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('backoff-base', '2')").run();
} catch (err) {
  console.error('Failed to bootstrap default configurations:', err.message);
}

export default db;
