/**
 * commands/dlq.js — CLI commands for Dead Letter Queue (DLQ)
 *
 * Responsibilities:
 *   - Parses commands for `queuectl dlq list` and `queuectl dlq retry <jobId>`.
 *   - Delegates business checks and state transitions to DlqService.
 *   - Formats outputs cleanly to stdout/stderr and sets non-zero exit codes on failure.
 *
 * Does NOT contain database queries or business state updates directly.
 */

import * as dlqService from '../services/dlqService.js';

/**
 * Handles `queuectl dlq list` command action.
 * Displays all dead jobs or prints a message if the DLQ is empty.
 */
export function dlqListAction() {
  try {
    const deadJobs = dlqService.listDeadJobs();

    if (deadJobs.length === 0) {
      console.log('Dead Letter Queue is empty.');
      return;
    }

    console.log('Dead Letter Queue');
    console.log('--------------------------------');
    for (const job of deadJobs) {
      console.log(job.id);
      console.log(`attempts: ${job.attempts}`);
      console.log(`command: ${job.command}`);
      console.log('--------------------------------');
    }
  } catch (err) {
    console.error(`✗ Failed to list DLQ: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handles `queuectl dlq retry <jobId>` command action.
 * Moves a dead job back to pending.
 *
 * @param {string} jobId
 */
export function dlqRetryAction(jobId) {
  try {
    dlqService.retryDeadJob(jobId);
    console.log(`✓ Job ${jobId} moved back to pending.`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
