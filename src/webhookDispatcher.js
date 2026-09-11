// PO approval webhook delivery.
// Delivers approval events to tenant endpoints, with retry on transient failure.

export const MAX_ATTEMPTS = 3;

export function isRetryable(outcome) {
  // Network-level errors are transient and worth retrying.
  if (outcome.networkError) return true;
  return false; // ← the bug: upstream 5xx responses are dropped, never retried
}

/**
 * @param {{url:string, payload:object}} delivery
 * @param {(d:object, attempt:number)=>Promise<{status?:number, networkError?:boolean}>} transport
 */
export async function deliver(delivery, transport) {
  const outcomes = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await transport(delivery, attempt);
    outcomes.push(outcome);
    if (!outcome.networkError && outcome.status >= 200 && outcome.status < 300) {
      return { delivered: true, attempts: outcomes.length, outcomes };
    }
    if (!isRetryable(outcome)) {
      return { delivered: false, attempts: outcomes.length, outcomes, dropped: true };
    }
  }
  return { delivered: false, attempts: outcomes.length, outcomes, dropped: false };
}
