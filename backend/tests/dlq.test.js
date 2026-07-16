process.env.NODE_ENV = 'test';

import * as dlqService from '../src/services/dlqService.js';
import { processNextJob } from '../src/workers/worker.js';
import { enqueue } from '../src/services/queueService.js';
import db from '../src/database/database.js';

describe('Dead Letter Queue (DLQ) tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  test('should move a failed job to dead state when retries are exhausted', async () => {
    // Seed a job and set it to failed with attempts > max_retries
    enqueue(JSON.stringify({ id: 'dlq-job-1', command: 'invalid_cmd' }));
    db.prepare('UPDATE jobs SET attempts = 3, max_retries = 3 WHERE id = ?').run('dlq-job-1');

    // Run the job. Since it fails and attempts becomes 4 > 3, it should be promoted to dead
    await processNextJob('Test-Worker');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('dlq-job-1');
    expect(job.state).toBe('dead');
    expect(job.next_retry_at).toBeNull();
  });

  test('should retrieve all dead jobs using listDeadJobs()', () => {
    // Seed 2 dead jobs and 1 completed job
    enqueue(JSON.stringify({ id: 'dlq-dead-1', command: 'cmd1' }));
    enqueue(JSON.stringify({ id: 'dlq-dead-2', command: 'cmd2' }));
    enqueue(JSON.stringify({ id: 'dlq-completed', command: 'cmd3' }));

    db.prepare("UPDATE jobs SET state = 'dead' WHERE id LIKE 'dlq-dead-%'").run();
    db.prepare("UPDATE jobs SET state = 'completed' WHERE id = 'dlq-completed'").run();

    const deadJobs = dlqService.listDeadJobs();
    expect(deadJobs.length).toBe(2);
    expect(deadJobs.map(j => j.id)).toContain('dlq-dead-1');
    expect(deadJobs.map(j => j.id)).toContain('dlq-dead-2');
  });

  test('should reset attempts and state to pending when retrying a dead job', () => {
    enqueue(JSON.stringify({ id: 'dlq-retry-1', command: 'cmd1' }));
    db.prepare("UPDATE jobs SET state = 'dead', attempts = 4 WHERE id = ?").run('dlq-retry-1');

    dlqService.retryDeadJob('dlq-retry-1');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('dlq-retry-1');
    expect(job.state).toBe('pending');
    expect(job.attempts).toBe(0);
    expect(job.next_retry_at).toBeNull();
  });

  test('should throw error when attempting to retry a non-dead job', () => {
    enqueue(JSON.stringify({ id: 'dlq-non-dead', command: 'cmd1' }));

    expect(() => {
      dlqService.retryDeadJob('dlq-non-dead');
    }).toThrow('Job is not in DLQ.');
  });

  test('should throw error when moving a completed job to DLQ', () => {
    enqueue(JSON.stringify({ id: 'dlq-done', command: 'cmd1' }));
    db.prepare("UPDATE jobs SET state = 'completed' WHERE id = ?").run('dlq-done');

    expect(() => {
      dlqService.moveToDead('dlq-done');
    }).toThrow('Cannot move completed jobs into DLQ.');
  });
});
