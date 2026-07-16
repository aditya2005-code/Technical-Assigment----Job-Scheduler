import * as configRepository from '../repositories/configRepository.js';

const ALLOWED_KEYS = new Set(['max-retries', 'backoff-base']);

export function validateConfig(key, value) {
  if (!ALLOWED_KEYS.has(key)) {
    throw new Error(`Unknown configuration key: "${key}".`);
  }

  const num = Number(value);

  if (!Number.isInteger(num) || String(value).includes('.')) {
    throw new Error('Configuration value must be an integer.');
  }

  if (num < 0) {
    throw new Error('Configuration value cannot be negative.');
  }

  if (num === 0) {
    throw new Error('Configuration value cannot be zero.');
  }
}

export function setConfig(key, value) {
  validateConfig(key, value);
  configRepository.setConfig(key, String(value));
}

export function getConfig(key, fallback) {
  const value = configRepository.getConfig(key);
  if (value === null || value === undefined) {
    if (fallback !== undefined) return fallback;

    if (key === 'max-retries') return 3;
    if (key === 'backoff-base') return 2;
    return 0;
  }
  return parseInt(value, 10);
}

export function getAllConfig() {
  return configRepository.getAllConfig();
}
