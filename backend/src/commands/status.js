/**
 * commands/status.js — CLI handler for status command
 *
 * Responsibilities:
 *   - Registers with Commander for `queuectl status`.
 *   - Fetches metrics from StatusService.
 *   - Prints a formatted, reader-friendly queue status report.
 */

import * as statusService from '../services/statusService.js';

/**
 * Action handler for the `queuectl status` command.
 */
export function statusAction() {
  try {
    const stats = statusService.getQueueStatus();

    console.log('Queue Status');
    console.log('----------------------------');
    console.log(`Pending      : ${stats.pending}`);
    console.log(`Processing   : ${stats.processing}`);
    console.log(`Completed    : ${stats.completed}`);
    console.log(`Failed       : ${stats.failed}`);
    console.log(`Dead         : ${stats.dead}`);
    console.log(`Workers      : ${stats.workers}`);
    console.log(`Total Jobs   : ${stats.totalJobs}`);
  } catch (err) {
    console.error(`✗ Failed to load queue status: ${err.message}`);
    process.exit(1);
  }
}
