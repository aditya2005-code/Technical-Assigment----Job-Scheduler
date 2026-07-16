/**
 * executor.js — Shell command execution
 *
 * WHY execSync instead of spawn: The worker is intentionally
 * single-threaded and processes one job at a time. execSync keeps
 * the code simple and eliminates the need to manage streams and
 * callbacks while waiting for the child process to finish.
 *
 * WHY we capture stdout/stderr: For future observability (logging,
 * status reporting). Even though we don't persist them in Part 2,
 * the return shape already includes them so no caller refactor is
 * needed when we do.
 *
 * WHY shell: true: Jobs are arbitrary shell commands (e.g. "echo Hello",
 * "node script.js"). Passing them through a shell interprets pipes,
 * redirects, and builtins correctly, just like a user would run them
 * in a terminal.
 */

import { execSync } from 'child_process';

/**
 * @typedef {object} ExecutionResult
 * @property {boolean} success  - true if exit code was 0
 * @property {string}  stdout   - captured standard output (trimmed)
 * @property {string}  stderr   - captured standard error (trimmed)
 * @property {number}  exitCode - the actual exit code
 */

/**
 * Executes a shell command synchronously and returns a structured result.
 * This function NEVER throws — all errors are captured in the return value
 * so the worker loop can decide how to handle them without a try/catch at
 * every call site.
 *
 * @param {string} command - The shell command to execute.
 * @returns {ExecutionResult}
 */
export function execute(command) {
  try {
    const stdout = execSync(command, {
      shell:   true,
      timeout: 30_000,        // 30 s hard limit — prevents zombie jobs
      encoding: 'utf8',
    });

    return {
      success:  true,
      stdout:   stdout.trim(),
      stderr:   '',
      exitCode: 0,
    };
  } catch (err) {
    // execSync throws when exit code ≠ 0. The error object contains
    // stdout, stderr, and status (exit code) from the child process.
    return {
      success:  false,
      stdout:   (err.stdout ?? '').trim(),
      stderr:   (err.stderr ?? err.message ?? '').trim(),
      exitCode: err.status ?? 1,
    };
  }
}
