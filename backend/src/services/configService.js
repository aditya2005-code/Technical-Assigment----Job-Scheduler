/**
 * configService.js — Configuration business logic
 *
 * WHY this service exists:
 * It enforces configuration rules, validates allowed keys, and ensures only
 * positive non-zero integers are stored. It acts as the controller between
 * the CLI command and the database storage.
 */

import * as configRepository from '../repositories/configRepository.js';

const ALLOWED_KEYS = new Set(['max-retries', 'backoff-base']);

/**
 * Validates a configuration key and value.
 *
 * @param {string} key
 * @param {string|number} value
 * @throws {Error} If key is unknown or value is not a positive non-zero integer.
 */
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

/**
 * Sets a configuration value after validation.
 *
 * @param {string} key
 * @param {string|number} value
 */
export function setConfig(key, value) {
  validateConfig(key, value);
  configRepository.setConfig(key, String(value));
}

/**
 * Gets a configuration value as an integer.
 * Returns a fallback default if not found in database.
 *
 * @param {string} key
 * @param {number} [fallback]
 * @returns {number}
 */
export function getConfig(key, fallback) {
  const value = configRepository.getConfig(key);
  if (value === null || value === undefined) {
    if (fallback !== undefined) return fallback;
    // Default fallback values if DB lookup somehow returns null
    if (key === 'max-retries') return 3;
    if (key === 'backoff-base') return 2;
    return 0;
  }
  return parseInt(value, 10);
}

/**
 * Returns all configurations.
 *
 * @returns {object[]} Array of { key, value }
 */
export function getAllConfig() {
  return configRepository.getAllConfig();
}
