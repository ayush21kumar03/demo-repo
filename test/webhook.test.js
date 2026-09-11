import { describe, it, expect } from "vitest";
import { deliver, isRetryable, MAX_ATTEMPTS, BASE_RETRY_DELAY_MS } from "../src/webhookDispatcher.js";

const delivery = { url: "https://tenant.example/hooks/po", payload: { po: "PO-1001" } };

/** transport that returns the scripted outcome for each attempt. */
const scripted = (...outcomes) => async (_d, attempt) => outcomes[attempt - 1] ?? outcomes[outcomes.length - 1];

describe("webhook delivery — success paths", () => {
  it("delivers on a 200 at the first attempt", async () => {
    const r = await deliver(delivery, scripted({ status: 200 }));
    expect(r.delivered).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("delivers on a 201", async () => {
    expect((await deliver(delivery, scripted({ status: 201 }))).delivered).toBe(true);
  });

  it("caps retries at MAX_ATTEMPTS", () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("reports the attempt count accurately", async () => {
    const r = await deliver(delivery, scripted({ networkError: true }, { status: 200 }));
    expect(r.attempts).toBe(2);
  });
});

describe("webhook delivery — transient network failures", () => {
  it("retries after a network error and then succeeds", async () => {
    const r = await deliver(delivery, scripted({ networkError: true }, { status: 200 }));
    expect(r.delivered).toBe(true);
  });

  it("gives up after MAX_ATTEMPTS of persistent network errors", async () => {
    const r = await deliver(delivery, scripted({ networkError: true }));
    expect(r.delivered).toBe(false);
    expect(r.attempts).toBe(MAX_ATTEMPTS);
  });
});

describe("webhook delivery — upstream 5xx must be retried (PRO-1242)", () => {
  it("retries a 500 and succeeds on the second attempt", async () => {
    const r = await deliver(delivery, scripted({ status: 500 }, { status: 200 }));
    expect(r.delivered).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it("retries a 502", async () => {
    const r = await deliver(delivery, scripted({ status: 502 }, { status: 200 }));
    expect(r.delivered).toBe(true);
  });

  it("retries a 503", async () => {
    const r = await deliver(delivery, scripted({ status: 503 }, { status: 200 }));
    expect(r.delivered).toBe(true);
  });

  it("retries a 504", async () => {
    const r = await deliver(delivery, scripted({ status: 504 }, { status: 200 }));
    expect(r.delivered).toBe(true);
  });

  it("classifies every 5xx as retryable", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isRetryable({ status })).toBe(true);
    }
  });

  it("classifies a 429 as retryable", () => {
    expect(isRetryable({ status: 429 })).toBe(true);
  });
});

describe("webhook delivery — client errors are permanent", () => {
  it("drops a 400 without retrying", async () => {
    const r = await deliver(delivery, scripted({ status: 400 }));
    expect(r.dropped).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("drops a 404 without retrying", async () => {
    const r = await deliver(delivery, scripted({ status: 404 }));
    expect(r.dropped).toBe(true);
  });
});

// The delivery contract is not only "retry a 5xx". A tenant gateway that is
// shedding load answers 503 or 429 WITH a Retry-After header, and hammering it
// on our own fixed backoff is what turns a blip into an outage. These assert
// the documented contract, not just the symptom in the ticket.
describe("webhook delivery — Retry-After must be honoured", () => {
  it("waits as long as a 503 asks it to", async () => {
    const r = await deliver(delivery, scripted({ status: 503, retryAfterSeconds: 30 }, { status: 200 }));
    expect(r.delivered).toBe(true);
    expect(r.delays[0]).toBe(30_000);
  });

  it("waits as long as a 429 asks it to", async () => {
    const r = await deliver(delivery, scripted({ status: 429, retryAfterSeconds: 5 }, { status: 200 }));
    expect(r.delays[0]).toBe(5_000);
  });

  it("falls back to its own backoff when Retry-After is absent", async () => {
    const r = await deliver(delivery, scripted({ status: 500 }, { status: 200 }));
    expect(r.delays[0]).toBe(BASE_RETRY_DELAY_MS);
  });

  it("backs off further on each successive attempt", async () => {
    const r = await deliver(delivery, scripted({ status: 500 }));
    expect(r.delays).toEqual([BASE_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2]);
  });
});
