import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as retryService from '../services/retryService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT_PATH = join(__dirname, 'worker.js');

const workerStatusMap = new Map();
const activeWorkers = new Map();

let isShuttingDown = false;
let schedulerInterval = null;

export function start(count = 1) {
  return new Promise((resolve) => {
    console.log('WorkerManager started');
    console.log(`Starting ${count} workers...`);

    schedulerInterval = setInterval(() => {
      try {
        retryService.processScheduledRetries();
      } catch (err) {
        console.error('Scheduler tick encountered an error:', err.message);
      }
    }, 1000);

    for (let i = 1; i <= count; i++) {
      const workerId = `Worker-${i}`;
      spawnWorker(workerId);
    }

    const onShutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n⚠  Received ${signal}. Shutting down workers gracefully...`);

      if (schedulerInterval) {
        clearInterval(schedulerInterval);
      }

      if (activeWorkers.size === 0) {
        console.log('WorkerManager shut down gracefully.');
        process.exit(0);
      }

      for (const [workerId, worker] of activeWorkers.entries()) {
        worker.postMessage({ type: 'shutdown' });
      }
    };

    process.on('SIGINT',  () => onShutdown('SIGINT'));
    process.on('SIGTERM', () => onShutdown('SIGTERM'));
  });
}

function spawnWorker(workerId) {

  workerStatusMap.set(workerId, { status: 'idle', jobId: null });

  const worker = new Worker(WORKER_SCRIPT_PATH, {
    workerData: { id: workerId },
  });

  activeWorkers.set(workerId, worker);
  console.log(`${workerId} started`);

  worker.on('message', (msg) => {
    if (msg.type === 'status') {
      const status = workerStatusMap.get(workerId);
      if (status) {
        status.status = msg.status;
        status.jobId = msg.jobId;
      }
    }
  });

  worker.on('error', (err) => {
    console.error(`✗ Worker ${workerId} encountered an error: ${err.message}`);
  });

  worker.on('exit', (code) => {
    activeWorkers.delete(workerId);
    workerStatusMap.delete(workerId);

    if (code !== 0 && !isShuttingDown) {
      console.error(`✗ Worker ${workerId} crashed unexpectedly (exit code ${code}).`);
    }

    if (isShuttingDown && activeWorkers.size === 0) {
      console.log('WorkerManager shut down gracefully.');
      process.exit(0);
    }
  });
}

export function getStatus() {
  return new Map(workerStatusMap);
}
