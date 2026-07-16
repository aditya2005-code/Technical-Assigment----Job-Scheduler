/**
 * backoff.js — Exponential backoff calculator
 *
 * Single responsibility: Export calculateBackoffDelay(attempts, base)
 *
 * WHY base and attempts arguments:
 * Decoupling this function from configuration constants (like CONFIG.BACKOFF_BASE)
 * makes it highly reusable and unit-testable. The caller is responsible for
 * supplying the base configuration.
 *
 * Formula:
 *   delaySeconds = base ^ attempts
 */

/**
 * Calculates exponential backoff delay.
 *
 * @param {number} attempts - Current execution attempt count (1-indexed).
 * @param {number} base     - The base multiplier for exponential growth.
 * @returns {number} Delay duration in seconds.
 */
export function calculateBackoffDelay(attempts, base) {
  if (attempts < 1) return 0;
  return Math.pow(base, attempts);
}
