process.env.NODE_ENV = 'test';

import * as statusService from '../src/services/statusService.js';
import db from '../src/database/database.js';

describe('Queue Status tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should return correct status metrics when jobs exist in various states', () => {
    const now = new Date().toISOString();

    // Helper to insert directly
    const insertRaw = (id, state) => {
      db.prepare(`
        INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
        VALUES (?, 'echo test', ?, 0, 3, ?, ?)
      `).run(id, state, now, now);
    };

    insertRaw('j-pending-1', 'pending');
    insertRaw('j-pending-2', 'pending');
    insertRaw('j-proc-1', 'processing');
    insertRaw('j-comp-1', 'completed');
    insertRaw('j-comp-2', 'completed');
    insertRaw('j-fail-1', 'failed');
    insertRaw('j-dead-1', 'dead');

    const stats = statusService.getQueueStatus();

    expect(stats.pending).toBe(2);
    expect(stats.processing).toBe(1);
    expect(stats.completed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.dead).toBe(1);
    expect(stats.totalJobs).toBe(7);
    expect(stats.workers).toBe(0); // No active threads running in this test
  });

  test('should return all zeros when database queue is empty', () => {
    const stats = statusService.getQueueStatus();

    expect(stats.pending).toBe(0);
    expect(stats.processing).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.dead).toBe(0);
    expect(stats.totalJobs).toBe(0);
    expect(stats.workers).toBe(0);
  });
});
