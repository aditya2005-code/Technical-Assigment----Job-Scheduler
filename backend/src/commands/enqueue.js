import * as queueService from '../services/queueService.js';

export function enqueueAction(jsonInput) {
  try {
    const job = queueService.enqueue(jsonInput);
    console.log(`✓ Job ${job.id} added successfully.`);
  } catch (err) {
    console.error(`✗ ${err.message}`);

    process.exit(1);
  }
}
