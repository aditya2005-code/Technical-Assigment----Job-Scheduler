/**
 * validator.js — Input validation helpers
 *
 * WHY throw instead of returning error objects: The call-site
 * (QueueService) uses a simple try/catch. Throwing keeps validation
 * logic self-contained and avoids leaking error-handling boilerplate
 * up into the service layer.
 *
 * WHY keep validation separate from the service: Following the
 * Single Responsibility Principle — the service orchestrates, the
 * validator enforces rules. This also makes unit-testing
 * validation logic trivial without spinning up a database.
 */

/**
 * Parses a raw JSON string and returns the resulting object.
 *
 * @param {string} raw - The raw string from the CLI argument.
 * @returns {object} Parsed JSON object.
 * @throws {Error} If the string is not valid JSON.
 */
export function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // Provide a user-friendly message instead of the cryptic
    // SyntaxError that JSON.parse normally throws.
    throw new Error('Invalid JSON.');
  }
}

/**
 * Validates that the parsed payload contains all required fields
 * with acceptable values.
 *
 * @param {object} payload - The parsed job payload.
 * @throws {Error} If any required field is missing or invalid.
 */
export function validateJobPayload(payload) {
  if (!payload.id || typeof payload.id !== 'string' || !payload.id.trim()) {
    throw new Error('Job "id" is required and must be a non-empty string.');
  }

  if (!payload.command || typeof payload.command !== 'string' || !payload.command.trim()) {
    throw new Error('Command cannot be empty.');
  }
}
