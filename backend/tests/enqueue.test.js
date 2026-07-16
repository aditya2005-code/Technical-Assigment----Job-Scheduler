process.env.NODE_ENV = 'test';

import { enqueue } from '../src/services/queueService.js';
import db from '../src/database/database.js';

describe('Enqueue Service tests', () => {
  beforeEach(() => {
    // Clear jobs database before each test to maintain isolation
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    // Clean up after all tests finish
    db.prepare('DELETE FROM jobs').run();
  });

  test('should insert a valid job successfully', () => {
    const payload = JSON.stringify({ id: 'job-1', command: 'echo hello' });
    const job = enqueue(payload);

    expect(job.id).toBe('job-1');
    expect(job.command).toBe('echo hello');
    expect(job.state).toBe('pending');
    expect(job.attempts).toBe(0);

    // Verify database record
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get('job-1');
    expect(row).toBeDefined();
    expect(row.command).toBe('echo hello');
    expect(row.state).toBe('pending');
  });

  test('should reject duplicate job IDs', () => {
    const payload = JSON.stringify({ id: 'job-dup', command: 'echo first' });
    enqueue(payload);

    expect(() => {
      enqueue(payload);
    }).toThrow('Job ID already exists.');
  });

  test('should reject invalid JSON strings', () => {
    expect(() => {
      enqueue('not-a-json-string');
    }).toThrow('Invalid JSON.');
  });

  test('should reject payload with missing command', () => {
    const payload = JSON.stringify({ id: 'job-no-cmd' });

    expect(() => {
      enqueue(payload);
    }).toThrow('Command cannot be empty.');
  });

  test('should reject payload with empty command string', () => {
    const payload = JSON.stringify({ id: 'job-empty-cmd', command: '   ' });

    expect(() => {
      enqueue(payload);
    }).toThrow('Command cannot be empty.');
  });
});
