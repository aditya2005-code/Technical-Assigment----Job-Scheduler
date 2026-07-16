process.env.NODE_ENV = 'test';

import { enqueue } from '../src/services/queueService.js';
import { processNextJob } from '../src/workers/worker.js';
import * as retryService from '../src/services/retryService.js';
import * as dlqService   from '../src/services/dlqService.js';
import db from '../src/database/database.js';

describe('End-to-End Queue CTL Integration Workflow', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
    // Default config values
    db.prepare("UPDATE config SET value = '3' WHERE key = 'max-retries'").run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should traverse the complete job state lifecycle successfully', async () => {
    const jobId = 'e2e-job-lifecycle';

    // ── 1. ENQUEUE ──
    enqueue(JSON.stringify({ id: jobId, command: 'invalid_cmd_to_test_retry' }));
    
    let job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('pending');
    expect(job.attempts).toBe(0);

    // ── 2. RUN WORKER & FAIL (Attempt 1) ──
    await processNextJob('E2E-Worker');
    
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(1);
    expect(job.next_retry_at).not.toBeNull();

    // ── 3. AUTOMATIC RETRY (Scheduler Tick + Attempt 2) ──
    // Simulate backoff timer passing
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(jobId);
    retryService.processScheduledRetries();
    
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('pending');

    await processNextJob('E2E-Worker'); // fails again
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(2);

    // ── 4. EXHAUST RETRIES & MOVE TO DLQ (Attempt 3 & 4) ──
    // Reset to pending
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(jobId);
    retryService.processScheduledRetries();
    await processNextJob('E2E-Worker'); // fails again, attempts -> 3
    
    // Reset to pending
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(jobId);
    retryService.processScheduledRetries();
    await processNextJob('E2E-Worker'); // fails again, attempts -> 4 > max_retries (3)

    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('dead');
    expect(job.next_retry_at).toBeNull();
    expect(job.attempts).toBe(4);

    // ── 5. MANUAL RETRY FROM DLQ ──
    // Fix the command first so it succeeds on the next run
    db.prepare("UPDATE jobs SET command = 'echo \"E2E Success!\"' WHERE id = ?").run(jobId);
    
    dlqService.retryDeadJob(jobId);

    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('pending');
    expect(job.attempts).toBe(0); // attempts reset to 0

    // ── 6. WORKER PROCESSES AND COMPLETES ──
    await processNextJob('E2E-Worker');

    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('completed');
    expect(job.attempts).toBe(0);
  });
});
