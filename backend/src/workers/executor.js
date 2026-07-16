import { spawn } from 'child_process';

export function executeCommand(command, timeoutMs = 30000) {
  return new Promise((resolve) => {

    const child = spawn(command, {
      shell: true,
    });

    let stdoutData = '';
    let stderrData = '';
    let resolved = false;

    child.stdout?.on('data', (chunk) => {
      stdoutData += chunk;
    });

    child.stderr?.on('data', (chunk) => {
      stderrData += chunk;
    });

    const cleanup = () => {
      clearTimeout(timer);
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.removeAllListeners('close');
      child.stdout?.removeAllListeners('data');
      child.stderr?.removeAllListeners('data');
    };

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;

      cleanup();

      try {

        child.kill();
      } catch (err) {

      }

      resolve({
        success: false,
        exitCode: null,
        stdout: stdoutData.trim(),
        stderr: 'Command timed out',
      });
    }, timeoutMs);

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

export const execute = executeCommand;
