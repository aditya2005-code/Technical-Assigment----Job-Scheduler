import { isMainThread, parentPort, workerData } from 'worker_threads';
import * as jobRepository from '../repositories/jobRepository.js';
import * as lockService    from '../services/lockService.js';
import * as retryService   from '../services/retryService.js';
import { execute }         from './executor.js';

export async function processNextJob(workerId = 'Worker') {

  const job = jobRepository.getNextPendingJob();

  if (!job) {
    return false;
  }

  const locked = lockService.lockJob(job.id);
  if (!locked) {

    return false;
  }

  if (parentPort) {
    parentPort.postMessage({ type: 'status', status: 'busy', jobId: job.id });
  }

  console.log(`${workerId} processing job ${job.id}`);

  const result = await execute(job.command);

  if (result.success) {
    jobRepository.markCompleted(job.id);
    console.log(`${workerId} completed job ${job.id}`);
    if (result.stdout) console.log(`   stdout: ${result.stdout}`);
  } else {
    console.error(`${workerId} failed job ${job.id}`);
    if (result.stderr) console.error(`   stderr: ${result.stderr}`);

    retryService.handleFailure(job);
  }

  lockService.unlockJob(job.id);

  if (parentPort) {
    parentPort.postMessage({ type: 'status', status: 'idle', jobId: null });
  }

  return true;
}

async function runWorkerLoop(workerId) {
  let shuttingDown = false;

  parentPort.on('message', (msg) => {
    if (msg.type === 'shutdown') {
      shuttingDown = true;
    }
  });

  parentPort.postMessage({ type: 'status', status: 'idle', jobId: null });

  while (!shuttingDown) {
    try {
      const didWork = await processNextJob(workerId);

      if (!didWork) {

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`[${workerId}] Polling loop error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  process.exit(0);
}

if (!isMainThread) {
  const workerId = workerData?.id || 'Worker';
  runWorkerLoop(workerId);
}
