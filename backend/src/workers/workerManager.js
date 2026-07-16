/**
 * workerManager.js — Worker thread manager
 *
 * WHY worker threads over child processes:
 * Worker threads are lightweight and run in-process, allowing them to share the
 * main process's native library instances (like SQLite connections, which are
 * thread-local but point to the same DB file safely in WAL mode). Spawning separate
 * Node processes carries higher memory overhead and is more brittle under global
 * CLI installation layouts.
 *
 * WHY parentPort message passing:
 * The manager acts as the coordinator. It runs the retry scheduler tick (isolating
 * it from workers) and tracks worker states (Idle/Busy/Job ID). Message passing
 * allows status updates to flow from threads back to the parent dynamically, which
 * cleanly supports future status command reporting.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as retryService from '../services/retryService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT_PATH = join(__dirname, 'worker.js');

// Status tracking map: workerId -> { status: 'idle' | 'busy', jobId: null }
const workerStatusMap = new Map();
const activeWorkers = new Map(); // workerId -> Worker instance

let isShuttingDown = false;
let schedulerInterval = null;

/**
 * Starts N concurrent worker threads.
 *
 * @param {number} count - Number of workers to launch.
 */
export function start(count = 1) {
  return new Promise((resolve) => {
    console.log('WorkerManager started');
    console.log(`Starting ${count} workers...`);

    // 1. Run the retry scheduler tick in the main thread (parent) once per second.
    // This centralizes database updates and prevents SQLite write conflicts.
    schedulerInterval = setInterval(() => {
      try {
        retryService.processScheduledRetries();
      } catch (err) {
        console.error('Scheduler tick encountered an error:', err.message);
      }
    }, 1000);

    // 2. Launch requested worker threads
    for (let i = 1; i <= count; i++) {
      const workerId = `Worker-${i}`;
      spawnWorker(workerId);
    }

    // 3. Register graceful shutdown handlers in the main process
    const onShutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n⚠  Received ${signal}. Shutting down workers gracefully...`);

      // Stop scheduling new retries
      if (schedulerInterval) {
        clearInterval(schedulerInterval);
      }

      if (activeWorkers.size === 0) {
        console.log('WorkerManager shut down gracefully.');
        process.exit(0);
      }

      // Send shutdown signals to all running threads
      for (const [workerId, worker] of activeWorkers.entries()) {
        worker.postMessage({ type: 'shutdown' });
      }
    };

    process.on('SIGINT',  () => onShutdown('SIGINT'));
    process.on('SIGTERM', () => onShutdown('SIGTERM'));
  });
}

/**
 * Spawns a single worker thread and sets up message handlers.
 *
 * @param {string} workerId
 */
function spawnWorker(workerId) {
  // Initialize status tracking
  workerStatusMap.set(workerId, { status: 'idle', jobId: null });

  const worker = new Worker(WORKER_SCRIPT_PATH, {
    workerData: { id: workerId },
  });

  activeWorkers.set(workerId, worker);
  console.log(`${workerId} started`);

  // Handle messages from the worker thread
  worker.on('message', (msg) => {
    if (msg.type === 'status') {
      const status = workerStatusMap.get(workerId);
      if (status) {
        status.status = msg.status;
        status.jobId = msg.jobId;
      }
    }
  });

  // Handle worker thread errors gracefully without crashing the master process
  worker.on('error', (err) => {
    console.error(`✗ Worker ${workerId} encountered an error: ${err.message}`);
  });

  // Handle worker thread exit
  worker.on('exit', (code) => {
    activeWorkers.delete(workerId);
    workerStatusMap.delete(workerId);

    if (code !== 0 && !isShuttingDown) {
      console.error(`✗ Worker ${workerId} crashed unexpectedly (exit code ${code}).`);
    }

    // If we are in the middle of shutting down and all workers have exited
    if (isShuttingDown && activeWorkers.size === 0) {
      console.log('WorkerManager shut down gracefully.');
      process.exit(0);
    }
  });
}

/**
 * Returns the status map of all workers (for future extensibility, e.g. status command).
 *
 * @returns {Map<string, { status: string, jobId: string|null }>}
 */
export function getStatus() {
  return new Map(workerStatusMap);
}
