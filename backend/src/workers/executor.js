/**
 * executor.js — Asynchronous shell command execution
 *
 * WHY child_process.spawn instead of execSync:
 * execSync blocks the single-threaded Node.js event loop during job
 * execution, preventing timer scheduling, signal intercepting, and
 * asynchronous operations. spawn runs asynchronously, returning a stream
 * interface that lets the event loop remain responsive. This makes it
 * easy to support concurrent worker counts in the future without blocking
 * the process.
 *
 * WHY shell: true:
 * Jobs are arbitrary CLI command strings. Executing them in a shell
 * ensures environment variables, string interpolation, pipe redirecting,
 * and built-in commands (like "echo") behave exactly as if executed in
 * a terminal.
 *
 * WHY clean event listener teardown:
 * To avoid memory leaks, once the process closes, exits, or encounters an
 * error, all registered listeners (and the timeout watchdog) are cleaned up.
 */

import { spawn } from 'child_process';

/**
 * @typedef {object} ExecutionResult
 * @property {boolean} success  - true if exit code was 0 and no error occurred
 * @property {string}  stdout   - captured standard output (trimmed)
 * @property {string}  stderr   - captured standard error (trimmed)
 * @property {number|null} exitCode - the process exit code, or null if killed/error
 */

/**
 * Executes a shell command asynchronously and returns a Promise resolving to
 * the structured execution result. This function NEVER rejects; all errors
 * are captured into the returned result object.
 *
 * @param {string} command - The CLI command string to execute.
 * @param {number} [timeoutMs=30000] - Hard execution time limit in milliseconds.
 * @returns {Promise<ExecutionResult>}
 */
export function executeCommand(command, timeoutMs = 30000) {
  return new Promise((resolve) => {
    // Determine OS shell configuration. On Windows, cmd.exe or powershell
    // are typically used. Passing shell: true delegates to the platform default.
    const child = spawn(command, {
      shell: true,
    });

    let stdoutData = '';
    let stderrData = '';
    let resolved = false;

    // Collect standard output stream
    child.stdout?.on('data', (chunk) => {
      stdoutData += chunk;
    });

    // Collect standard error stream
    child.stderr?.on('data', (chunk) => {
      stderrData += chunk;
    });

    // Clean up helper to release listeners and timers
    const cleanup = () => {
      clearTimeout(timer);
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.removeAllListeners('close');
      child.stdout?.removeAllListeners('data');
      child.stderr?.removeAllListeners('data');
    };

    // Watchdog timer for hard timeout limit
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;

      cleanup();

      try {
        // Kill the process tree. On Windows/POSIX, SIGKILL or default
        // signal is sent to the child process.
        child.kill();
      } catch (err) {
        // Ignore errors if process is already dead
      }

      resolve({
        success: false,
        exitCode: null,
        stdout: stdoutData.trim(),
        stderr: 'Command timed out',
      });
    }, timeoutMs);

    // Error event: triggered if the process cannot be spawned, killed, or
    // fails to send a message.
    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      resolve({
        success: false,
        exitCode: null,
        stdout: stdoutData.trim(),
        stderr: err.message || 'Execution error occurred',
      });
    });

    // Close event: triggered after the stdio streams of the child process
    // have been closed. This is preferred over 'exit' because it guarantees
    // all stdout/stderr chunks have finished flushing and reading.
    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      resolve({
        success: code === 0,
        exitCode: code,
        stdout: stdoutData.trim(),
        stderr: stderrData.trim(),
      });
    });
  });
}

// Keep the previous execute export mapping to executeCommand for backward compatibility
export const execute = executeCommand;
