let shuttingDown = false;

export function isShuttingDown() {
  return shuttingDown;
}

export function registerShutdownHandlers() {
  const onSignal = (signal) => {

    if (shuttingDown) return;

    shuttingDown = true;
    console.log(`\n⚠  Received ${signal}. Finishing current job then exiting...`);
  };

  process.on('SIGINT',  () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
}
