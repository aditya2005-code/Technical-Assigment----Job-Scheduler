import * as dlqService from '../services/dlqService.js';

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

export function dlqRetryAction(jobId) {
  try {
    dlqService.retryDeadJob(jobId);
    console.log(`✓ Job ${jobId} moved back to pending.`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
