process.env.NODE_ENV = 'test';

import * as workerManager from '../src/workers/workerManager.js';
import { enqueue } from '../src/services/queueService.js';
import db from '../src/database/database.js';

describe('Multi-worker concurrency tests', () => {
  let originalExit;
  let exitCalls = [];

  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
    originalExit = process.exit;
    exitCalls = [];
    process.exit = (code) => {
      exitCalls.push(code);
    };
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should process multiple jobs concurrently without duplicate execution', async () => {
    // 1. Enqueue 3 slow jobs (each taking 1 second)
    enqueue(JSON.stringify({ id: 'concurrent-1', command: 'node -e "setTimeout(() => {}, 1000)"' }));
    enqueue(JSON.stringify({ id: 'concurrent-2', command: 'node -e "setTimeout(() => {}, 1000)"' }));
    enqueue(JSON.stringify({ id: 'concurrent-3', command: 'node -e "setTimeout(() => {}, 1000)"' }));

    // 2. Start WorkerManager with 3 workers
    workerManager.start(3);

    // Give workers 1.5 seconds to pick up and process the jobs
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Emit SIGINT to trigger the manager's graceful shutdown flow
    process.emit('SIGINT');

    // Wait for the workers to clean up and exit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify process.exit was called (proving shutdown completed)
    expect(exitCalls).toContain(0);

    // Verify all jobs completed successfully and exactly once
    const jobs = db.prepare('SELECT * FROM jobs').all();
    expect(jobs.length).toBe(3);
    for (const job of jobs) {
      expect(job.state).toBe('completed');
      expect(job.attempts).toBe(0); // completed with 0 attempts (or 1 if failed, but here they succeed)
    }
  }, 10000); // 10s timeout limit for concurrent executions
});
