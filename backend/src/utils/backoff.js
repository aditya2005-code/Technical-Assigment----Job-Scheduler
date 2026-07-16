export function calculateBackoffDelay(attempts, base) {
  if (attempts < 1) return 0;
  return Math.pow(base, attempts);
}
