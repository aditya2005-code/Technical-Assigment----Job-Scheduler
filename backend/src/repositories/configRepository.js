/**
 * configRepository.js — Data access layer for the config table
 *
 * WHY this repository exists:
 * It isolates configuration storage in SQLite from the rest of the application,
 * maintaining a clear separation of concerns (SOLID).
 */

import db from '../database/database.js';

/**
 * Retrieves a configuration value by its key.
 *
 * @param {string} key
 * @returns {string|null} The configuration value, or null if not set.
 */
export function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Inserts or updates a configuration value.
 *
 * @param {string} key
 * @param {string} value
 */
export function setConfig(key, value) {
  db.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

/**
 * Returns all configurations as an array of key-value objects.
 *
 * @returns {object[]} Array of { key, value }
 */
export function getAllConfig() {
  return db.prepare('SELECT key, value FROM config ORDER BY key ASC').all();
}
