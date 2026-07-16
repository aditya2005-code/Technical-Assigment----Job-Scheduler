process.env.NODE_ENV = 'test';

import { processNextJob } from '../src/workers/worker.js';
import { enqueue } from '../src/services/queueService.js';
import { calculateBackoffDelay } from '../src/utils/backoff.js';
import * as retryService from '../src/services/retryService.js';
import db from '../src/database/database.js';

describe('Retry and Backoff tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should calculate backoff delay correctly based on base ^ attempts', () => {
    expect(calculateBackoffDelay(1, 2)).toBe(2);
    expect(calculateBackoffDelay(2, 2)).toBe(4);
    expect(calculateBackoffDelay(3, 2)).toBe(8);

    expect(calculateBackoffDelay(1, 3)).toBe(3);
    expect(calculateBackoffDelay(2, 3)).toBe(9);
  });

  test('should increment attempts and set next_retry_at on failure', async () => {
    enqueue(JSON.stringify({ id: 'retry-job-1', command: 'invalid_cmd' }));

    await processNextJob('Test-Worker');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('retry-job-1');
    expect(job.state).toBe('failed');
    expect(job.attempts).toBe(1);
    expect(job.next_retry_at).not.toBeNull();

    // Verify next_retry_at is formatted as an ISO-8601 string
    expect(isNaN(Date.parse(job.next_retry_at))).toBe(false);
  });

  test('should automatically reset job to pending when next_retry_at time passes', async () => {
    enqueue(JSON.stringify({ id: 'retry-job-2', command: 'invalid_cmd' }));

    // Execute first run -> transitions state to failed, next_retry_at set in future
    await processNextJob('Test-Worker');

    // Force next_retry_at to be in the past (e.g. 5 seconds ago) to simulate time passage
    const pastTime = new Date(Date.now() - 5000).toISOString();
    db.prepare('UPDATE jobs SET next_retry_at = ? WHERE id = ?').run(pastTime, 'retry-job-2');

    // Trigger the scheduler tick
    const resetCount = retryService.processScheduledRetries();
    expect(resetCount).toBe(1);

    // Verify state has returned to pending and next_retry_at cleared
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('retry-job-2');
    expect(job.state).toBe('pending');
    expect(job.next_retry_at).toBeNull();
  });

  test('should stop retrying and move to dead state after max_retries are exceeded', async () => {
    // Enqueue job with max_retries = 2
    enqueue(JSON.stringify({ id: 'retry-job-dead', command: 'invalid_cmd' }));
    db.prepare('UPDATE jobs SET max_retries = 2 WHERE id = ?').run('retry-job-dead');

    // 1st failure (attempts -> 1, retry scheduled)
    await processNextJob('Test-Worker');
    expect(db.prepare('SELECT state FROM jobs WHERE id = ?').get('retry-job-dead').state).toBe('failed');

    // Tock scheduler (reset to pending)
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run('retry-job-dead');
    retryService.processScheduledRetries();

    // 2nd failure (attempts -> 2, retry scheduled since max_retries = 2)
    await processNextJob('Test-Worker');
    expect(db.prepare('SELECT state FROM jobs WHERE id = ?').get('retry-job-dead').state).toBe('failed');

    // Tock scheduler (reset to pending)
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run('retry-job-dead');
    retryService.processScheduledRetries();

    // 3rd failure (attempts -> 3. 3 > max_retries (2) -> moved to DLQ (state='dead'))
    await processNextJob('Test-Worker');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('retry-job-dead');
    expect(job.state).toBe('dead');
    expect(job.next_retry_at).toBeNull();
    expect(job.attempts).toBe(3);
  });
});
