#!/usr/bin/env node
import { program } from 'commander';
import { enqueueAction }    from './commands/enqueue.js';
import { workerStartAction } from './commands/worker.js';
import { dlqListAction, dlqRetryAction } from './commands/dlq.js';
import { statusAction }     from './commands/status.js';
import { listAction }       from './commands/list.js';
import { configGetAction, configSetAction } from './commands/config.js';

program
  .name('queuectl')
  .description('CLI job queue manager backed by SQLite')
  .version('1.0.0');

program
  .command('enqueue <json>')
  .description('Add a new job to the queue')
  .addHelpText('after', `
Examples:
  $ node src/index.js enqueue '{"id":"job1","command":"echo Hello"}'
  ✓ Job job1 added successfully.
  `)
  .action(enqueueAction);

const worker = program
  .command('worker')
  .description('Manage the job worker process');

worker
  .command('start')
  .description('Start the worker polling loop')
  .option('-c, --count <number>', 'number of worker threads to run', '1')
  .addHelpText('after', `
Examples:
  $ node src/index.js worker start --count 3
  WorkerManager started
  Starting 3 workers...
  `)
  .action(workerStartAction);

const dlq = program
  .command('dlq')
  .description('Manage the Dead Letter Queue (DLQ)');

dlq
  .command('list')
  .description('List all dead jobs in the Dead Letter Queue')
  .action(dlqListAction);

dlq
  .command('retry <jobId>')
  .description('Manually retry a dead job by resetting it to pending')
  .action(dlqRetryAction);

program
  .command('status')
  .description('Display a summary of the queue status')
  .action(statusAction);

program
  .command('list')
  .description('List jobs from the queue')
  .option('-s, --state <state>', 'filter jobs by state (pending, processing, completed, failed, dead)')
  .action(listAction);

const configCmd = program
  .command('config')
  .description('Manage queuectl configuration settings');

configCmd
  .command('get [key]')
  .description('Retrieve all configurations or a specific key value')
  .action(configGetAction);

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (allowed: max-retries, backoff-base)')
  .action(configSetAction);

program.parse(process.argv);
