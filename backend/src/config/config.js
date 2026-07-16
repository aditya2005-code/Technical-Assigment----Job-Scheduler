import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '..', '.env');

if (existsSync(ENV_PATH)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(ENV_PATH);
    } catch (err) {

    }
  } else {

    try {
      const content = readFileSync(ENV_PATH, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (key) {
            process.env[key.trim()] = value;
          }
        }
      });
    } catch (err) {

    }
  }
}

export const CONFIG = Object.freeze({
  BACKOFF_BASE: parseInt(process.env.BACKOFF_BASE || '2', 10),
  MAX_RETRIES:  parseInt(process.env.MAX_RETRIES || '3', 10),
});
