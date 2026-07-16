process.env.NODE_ENV = 'test';

import { processNextJob } from '../src/workers/worker.js';
import { enqueue } from '../src/services/queueService.js';
import db from '../src/database/database.js';

describe('Worker Processing tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should process a pending job and update state to completed', async () => {
    enqueue(JSON.stringify({ id: 'worker-job-1', command: 'echo "hello"' }));

    const didWork = await processNextJob('Test-Worker');
    expect(didWork).toBe(true);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('worker-job-1');
    expect(job.state).toBe('completed');
    expect(job.attempts).toBe(0);
  });

  test('should process a failing job and transition it to failed', async () => {
    enqueue(JSON.stringify({ id: 'worker-job-fail', command: 'this_command_fails_xyz' }));

    const didWork = await processNextJob('Test-Worker');
    expect(didWork).toBe(true);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('worker-job-fail');
    // In Part 3, failed jobs schedule retry and transition to failed
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(1);
  });

  test('should return false if there are no pending jobs to process', async () => {
    const didWork = await processNextJob('Test-Worker');
    expect(didWork).toBe(false);
  });

  test('should continue running even if command execution fails', async () => {
    enqueue(JSON.stringify({ id: 'worker-job-fail-1', command: 'invalid_cmd' }));
    enqueue(JSON.stringify({ id: 'worker-job-ok', command: 'echo success' }));

    // Run first (failing) job
    const run1 = await processNextJob('Test-Worker');
    expect(run1).toBe(true);

    // Run second (succeeding) job to prove worker thread keeps running
    const run2 = await processNextJob('Test-Worker');
    expect(run2).toBe(true);

    const job1 = db.prepare('SELECT * FROM jobs WHERE id = ?').get('worker-job-fail-1');
    const job2 = db.prepare('SELECT * FROM jobs WHERE id = ?').get('worker-job-ok');

    expect(job1.state).toBe('failed');
    expect(job2.state).toBe('completed');
  });
});
