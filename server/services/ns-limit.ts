/**
 * Global NetSuite concurrency limiter.
 *
 * NetSuite enforces an ACCOUNT-WIDE "Concurrency Governance" limit: the maximum
 * number of SIMULTANEOUS in-flight inbound requests (REST record, SuiteQL,
 * RESTlet, OAuth token, OIDC, SOAP) across ALL integrations in the account.
 * This Customer Portal shares that single pool with every other integration.
 *
 * This module exposes ONE process-wide semaphore that EVERY code path which
 * issues an HTTP request to NetSuite must funnel through. It is the single
 * source of truth for how much of the shared pool this app may consume.
 *
 * Total account governance is ~4-5 concurrent; we deliberately cap this app at
 * NS_MAX_CONCURRENCY so other integrations always have headroom. Lower this
 * constant to 2 if other integrations need more of the pool.
 *
 * IMPORTANT — keep usage NON-REENTRANT. A single logical NetSuite operation
 * (e.g. "run a SuiteQL query") may need TWO inbound calls: first an OAuth token
 * fetch, then the query itself. NEVER acquire a slot for the query and then,
 * while holding it, acquire another slot for the token fetch — under a wide
 * Promise.all fan-out that deadlocks (all slots held by query callers waiting
 * for a token slot that never frees). Always: acquire+release the token slot
 * FIRST (getAccessToken does this internally), THEN acquire the query slot.
 * Each call to nsLimit(fn) must wrap exactly ONE fetch round-trip and must not
 * transitively call nsLimit again.
 */
import pLimit from 'p-limit';

/**
 * Maximum simultaneous in-flight NetSuite requests this app may have.
 * Single named constant so it can be tuned in one place. Account-wide
 * governance is ~4-5; 3 leaves 1-2 for other integrations.
 */
export const NS_MAX_CONCURRENCY = 3;

const limit = pLimit(NS_MAX_CONCURRENCY);

/**
 * Run a single NetSuite HTTP round-trip under the global concurrency cap.
 * Pass a thunk that performs exactly ONE fetch (+ its response parse) and
 * does NOT itself call nsLimit (no re-entrancy — see module note).
 */
export function nsLimit<T>(fn: () => Promise<T>): Promise<T> {
  return limit(fn);
}

/** Observability: how many slots are in use / queued right now. */
export function nsLimitStatus() {
  return {
    max: NS_MAX_CONCURRENCY,
    activeCount: limit.activeCount,
    pendingCount: limit.pendingCount,
  };
}
