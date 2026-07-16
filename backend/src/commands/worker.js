import * as workerService from '../services/workerService.js';

export async function workerStartAction(options) {
  const count = parseInt(options.count, 10);

  if (isNaN(count) || count <= 0) {
    console.error('✗ Worker count must be a positive integer.');
    process.exit(1);
  }

  try {
    await workerService.start(count);
  } catch (err) {
    console.error(`✗ Worker failed to start: ${err.message}`);
    process.exit(1);
  }
}
