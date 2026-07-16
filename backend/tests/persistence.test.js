process.env.NODE_ENV = 'test';

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../src/database/database.js';
import { enqueue } from '../src/services/queueService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'queue_test.db');

describe('Database Persistence tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should persist jobs on disk across connection restarts', () => {
    // 1. Enqueue a job using active service connection
    enqueue(JSON.stringify({ id: 'persist-job-1', command: 'echo "hello"' }));

    // 2. Open a separate, new connection directly to the test DB file (simulating startup)
    const newDbConnection = new Database(DB_PATH);

    try {
      const row = newDbConnection.prepare('SELECT * FROM jobs WHERE id = ?').get('persist-job-1');
      expect(row).toBeDefined();
      expect(row.id).toBe('persist-job-1');
      expect(row.command).toBe('echo "hello"');
      expect(row.state).toBe('pending');
    } finally {
      // Clean up connection handle
      newDbConnection.close();
    }
  });
});
