/**
 * shutdown.js — Graceful shutdown signal handler
 *
 * WHY a separate module: Signal handling has nothing to do with job
 * execution logic. Isolating it here means the worker loop can stay
 * focused on polling/processing, while this module owns the single
 * responsibility of intercepting OS signals.
 *
 * WHY a flag instead of process.exit() in the handler: Calling
 * process.exit() immediately inside a SIGINT/SIGTERM handler can
 * kill the process while a job is mid-execution, leaving that job
 * stuck in 'processing' state forever. The flag lets the worker
 * finish its current iteration first.
 *
 * Design: any module can import isShuttingDown() to check the flag.
 * registerShutdownHandlers() must be called once at startup.
 */

let shuttingDown = false;

/**
 * Returns true once a SIGINT or SIGTERM has been received.
 * The worker loop polls this to decide when to exit cleanly.
 *
 * @returns {boolean}
 */
export function isShuttingDown() {
  return shuttingDown;
}

/**
 * Registers SIGINT (Ctrl+C) and SIGTERM (kill) handlers.
 * Call this once when the worker starts.
 */
export function registerShutdownHandlers() {
  const onSignal = (signal) => {
    // Only act on the first signal — subsequent ones are ignored so
    // the current job can finish rather than being interrupted twice.
    if (shuttingDown) return;

    shuttingDown = true;
    console.log(`\n⚠  Received ${signal}. Finishing current job then exiting...`);
  };

  process.on('SIGINT',  () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
}
