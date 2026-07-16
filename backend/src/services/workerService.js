import * as workerManager from '../workers/workerManager.js';

export async function start(count = 1) {
  await workerManager.start(count);
}
