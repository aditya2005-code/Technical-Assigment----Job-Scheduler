/**
 * commands/list.js — CLI handler for list command
 *
 * Responsibilities:
 *   - Registers with Commander for `queuectl list`.
 *   - Parses optional `--state` option.
 *   - Calls ListService to fetch validated results.
 *   - Formats and prints jobs in a clean, padded CLI table.
 */

import * as listService from '../services/listService.js';

/**
 * Action handler for the `queuectl list` command.
 *
 * @param {object} options - Commander options containing optional state filter.
 */
export function listAction(options) {
  try {
    const jobs = listService.listJobs(options.state);

    if (jobs.length === 0) {
      console.log('No jobs found.');
      return;
    }

    printJobsTable(jobs);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}

/**
 * Formats and prints a list of Job instances as a padded CLI table.
 *
 * @param {Job[]} jobs
 */
function printJobsTable(jobs) {
  const colWidths = {
    id:       15,
    state:    12,
    attempts: 10,
    command:  35,
    updated:  24,
  };

  const pad = (val, width) => String(val || '').substring(0, width).padEnd(width);
  const padCommand = (cmd, width) => {
    const raw = String(cmd || '');
    if (raw.length > width) {
      return raw.substring(0, width - 3) + '...';
    }
    return raw.padEnd(width);
  };

  const headers = [
    pad('ID', colWidths.id),
    pad('STATE', colWidths.state),
    pad('ATTEMPTS', colWidths.attempts),
    padCommand('COMMAND', colWidths.command),
    pad('UPDATED', colWidths.updated),
  ].join(' ');

  console.log(headers);
  console.log('-'.repeat(colWidths.id + colWidths.state + colWidths.attempts + colWidths.command + colWidths.updated + 4));

  for (const job of jobs) {
    const row = [
      pad(job.id, colWidths.id),
      pad(job.state, colWidths.state),
      pad(job.attempts, colWidths.attempts),
      padCommand(job.command, colWidths.command),
      pad(job.updated_at, colWidths.updated),
    ].join(' ');
    console.log(row);
  }
}
