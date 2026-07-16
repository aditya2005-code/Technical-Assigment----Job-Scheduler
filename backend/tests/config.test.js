process.env.NODE_ENV = 'test';

import * as configService from '../src/services/configService.js';
import * as retryService  from '../src/services/retryService.js';
import { processNextJob } from '../src/workers/worker.js';
import { enqueue } from '../src/services/queueService.js';
import db from '../src/database/database.js';

describe('Configuration Management tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
    // Reset configurations to default
    db.prepare("UPDATE config SET value = '3' WHERE key = 'max-retries'").run();
    db.prepare("UPDATE config SET value = '2' WHERE key = 'backoff-base'").run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM jobs').run();
    db.prepare("UPDATE config SET value = '3' WHERE key = 'max-retries'").run();
    db.prepare("UPDATE config SET value = '2' WHERE key = 'backoff-base'").run();
  });

  test('should set and persist configuration values', () => {
    configService.setConfig('max-retries', '8');
    configService.setConfig('backoff-base', '4');

    expect(configService.getConfig('max-retries')).toBe(8);
    expect(configService.getConfig('backoff-base')).toBe(4);
  });

  test('should reject invalid keys and values during set', () => {
    // 1. Unknown key
    expect(() => {
      configService.setConfig('invalid-key', '10');
    }).toThrow('Unknown configuration key');

    // 2. Negative values
    expect(() => {
      configService.setConfig('max-retries', '-5');
    }).toThrow('Configuration value cannot be negative.');

    // 3. Zero value
    expect(() => {
      configService.setConfig('max-retries', '0');
    }).toThrow('Configuration value cannot be zero.');

    // 4. Non-integer value
    expect(() => {
      configService.setConfig('max-retries', '3.14');
    }).toThrow('Configuration value must be an integer.');
  });

  test('should respect updated config values in the retry service', async () => {
    // 1. Change max-retries configuration dynamically to 1
    configService.setConfig('max-retries', '1');

    // 2. Seed a job
    enqueue(JSON.stringify({ id: 'config-retry-test', command: 'invalid_cmd' }));

    // Run 1: fails, attempt becomes 1. 1 <= max-retries (1) -> scheduled retry
    await processNextJob('Test-Worker');
    expect(db.prepare('SELECT state FROM jobs WHERE id = ?').get('config-retry-test').state).toBe('failed');

    // Tock scheduler
    db.prepare("UPDATE jobs SET next_retry_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run('config-retry-test');
    retryService.processScheduledRetries();

    // Run 2: fails, attempt becomes 2. 2 > max-retries (1) -> promoted to dead (DLQ)
    await processNextJob('Test-Worker');
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('config-retry-test');
    expect(job.state).toBe('dead');
  });
});
