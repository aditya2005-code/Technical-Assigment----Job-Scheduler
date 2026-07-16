export function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {

    throw new Error('Invalid JSON.');
  }
}

export function validateJobPayload(payload) {
  if (!payload.id || typeof payload.id !== 'string' || !payload.id.trim()) {
    throw new Error('Job "id" is required and must be a non-empty string.');
  }

  if (!payload.command || typeof payload.command !== 'string' || !payload.command.trim()) {
    throw new Error('Command cannot be empty.');
  }
}
