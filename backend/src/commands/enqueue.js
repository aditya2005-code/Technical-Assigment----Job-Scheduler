/**
 * commands/enqueue.js — CLI command handler for "enqueue"
 *
 * WHY this layer exists: Commander parses argv and calls this action.
 * The handler's ONLY jobs are:
 *   1. Forward the raw input to QueueService.
 *   2. Print the outcome to stdout/stderr.
 *   3. Set the correct process exit code.
 *
 * It intentionally does NOT validate, parse JSON, or touch the DB.
 * Keeping command handlers thin makes them trivial to test and easy
 * to swap for a different CLI framework later.
 */

import * as queueService from '../services/queueService.js';

/**
 * Action handler registered with Commander for the "enqueue" command.
 *
 * @param {string} jsonInput - Raw JSON string supplied by the user.
 */
export function enqueueAction(jsonInput) {
  try {
    const job = queueService.enqueue(jsonInput);
    console.log(`✓ Job ${job.id} added successfully.`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    // Exit with a non-zero code so callers/scripts can detect failure.
    process.exit(1);
  }
}
