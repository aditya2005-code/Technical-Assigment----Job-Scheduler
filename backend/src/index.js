#!/usr/bin/env node
/**
 * index.js — CLI entry point for queuectl
 *
 * WHY Commander: It handles argv parsing, help text generation, and
 * sub-command routing with minimal boilerplate. We avoid reinventing
 * that wheel here.
 *
 * WHY no business logic here: This file is the composition root —
 * it wires commands to handlers and nothing more. Keeping it thin
 * means the entire CLI can be rewired without touching any logic.
 */

import { program } from 'commander';
import { enqueueAction } from './commands/enqueue.js';

program
  .name('queuectl')
  .description('CLI job queue manager backed by SQLite')
  .version('1.0.0');

// ── enqueue command ───────────────────────────────────────────────
program
  .command('enqueue <json>')
  .description('Add a new job to the queue')
  .addHelpText('after', `
Examples:
  $ node src/index.js enqueue '{"id":"job1","command":"echo Hello"}'
  ✓ Job job1 added successfully.
  `)
  .action(enqueueAction);

// Parse process.argv — Commander reads process.argv[2..] by default.
program.parse(process.argv);
