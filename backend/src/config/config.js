/**
 * config.js — Environment variable configuration loader
 *
 * WHY native process.loadEnvFile:
 * Modern Node.js versions (v20.6+) support native .env file loading via
 * process.loadEnvFile(). This avoids bringing in the external dotenv package,
 * keeping the dependency tree thin and the project install lightweight.
 *
 * WHY custom fallback:
 * If the environment doesn't have process.loadEnvFile or the file is missing,
 * we parse it manually or fall back to safe, production-ready defaults.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '..', '.env');

// Try loading the environment file natively or fall back to parsing it
if (existsSync(ENV_PATH)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(ENV_PATH);
    } catch (err) {
      // Ignore load error, fallback will handle it
    }
  } else {
    // Manual .env parser fallback for older Node versions
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
      // Ignore manual parsing error, default values will be applied
    }
  }
}

export const CONFIG = Object.freeze({
  BACKOFF_BASE: parseInt(process.env.BACKOFF_BASE || '2', 10),
  MAX_RETRIES:  parseInt(process.env.MAX_RETRIES || '3', 10),
});
