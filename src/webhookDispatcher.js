// PO approval webhook delivery.
// Delivers approval events to tenant endpoints, with retry on transient failure.

export const MAX_ATTEMPTS = 3;
export const BASE_RETRY_DELAY_MS = 1000;

export function isRetryable(outcome) {
  // Network-level errors are transient and worth retrying.
  if (outcome.networkError) return true;
  // Upstream 5xx errors and 429 (rate limited) are also transient and retryable.
  if (outcome.status >= 500) return true;
  if (outcome.status === 429) return true;
  return false;
}

/** How long to wait before the next attempt. */
export function retryDelayMs(outcome, attempt) {
  // Honour any Retry-After hint from the upstream (e.g. 429/503 responses).
  if (typeof outcome.retryAfterSeconds === 'number' && outcome.retryAfterSeconds >= 0) {
    return outcome.retryAfterSeconds * 1000;
  }
  return BASE_RETRY_DELAY_MS * attempt;
}

/**
 * @param {{url:string, payload:object}} delivery
 * @param {(d:object, attempt:number)=>Promise<{status?:number, networkError?:boolean, retryAfterSeconds?:number}>} transport
 */
export async function deliver(delivery, transport) {
  const outcomes = [];
  const delays = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await transport(delivery, attempt);
    outcomes.push(outcome);
    if (!outcome.networkError && outcome.status >= 200 && outcome.status < 300) {
      return { delivered: true, attempts: outcomes.length, outcomes, delays };
    }
    if (!isRetryable(outcome)) {
      return { delivered: false, attempts: outcomes.length, outcomes, delays, dropped: true };
    }
    if (attempt < MAX_ATTEMPTS) delays.push(retryDelayMs(outcome, attempt));
  }
  return { delivered: false, attempts: outcomes.length, outcomes, delays, dropped: false };
}
