/**
 * Lightweight in-process metrics for NetSuite traffic and cache effectiveness.
 *
 * Recorded by ns-limit.ts (every real NS HTTP call + peak concurrency) and
 * ns-cache.ts (hit / miss / stale-serve / error). Exposed via getMetricsSnapshot().
 *
 * NOTE: these counters are PER-PROCESS and reset on restart. On Replit autoscale
 * (multi-instance + scale-to-zero) they do NOT aggregate across instances. The
 * planned admin dashboard (PR #3) will persist bucketed counts to Postgres for a
 * true account-wide view; this module is the collection point those buckets read.
 */

export type NsRequestKind = 'token' | 'suiteql' | 'record' | 'restlet' | 'oidc' | 'other';
export type CacheEvent = 'hit' | 'miss' | 'stale' | 'error';

const startedAtMs = Date.now();

const requestCounts: Record<NsRequestKind, number> = {
  token: 0, suiteql: 0, record: 0, restlet: 0, oidc: 0, other: 0,
};
let totalRequests = 0;
let peakConcurrency = 0;

const cacheEvents: Record<CacheEvent, number> = { hit: 0, miss: 0, stale: 0, error: 0 };

// Deltas since the last flush, drained by the metrics flusher each minute and
// written to the ns_metrics rollup. Kept separate from the cumulative counters
// above (which back the live snapshot).
const pendingRequests: Record<NsRequestKind, number> = {
  token: 0, suiteql: 0, record: 0, restlet: 0, oidc: 0, other: 0,
};
const pendingCache: Record<CacheEvent, number> = { hit: 0, miss: 0, stale: 0, error: 0 };
let peakSinceFlush = 0;

/** Count one outbound NetSuite HTTP request (called from inside the limiter slot). */
export function recordNsRequest(kind: NsRequestKind): void {
  requestCounts[kind] = (requestCounts[kind] ?? 0) + 1;
  pendingRequests[kind] = (pendingRequests[kind] ?? 0) + 1;
  totalRequests++;
}

/** Track the high-water mark of simultaneous in-flight NetSuite requests. */
export function recordConcurrency(active: number): void {
  if (active > peakConcurrency) peakConcurrency = active;
  if (active > peakSinceFlush) peakSinceFlush = active;
}

/** Count a cache outcome. */
export function recordCache(event: CacheEvent): void {
  cacheEvents[event] = (cacheEvents[event] ?? 0) + 1;
  pendingCache[event] = (pendingCache[event] ?? 0) + 1;
}

export interface MetricsDelta {
  requests: Record<NsRequestKind, number>;
  cache: Record<CacheEvent, number>;
  peak: number;
}

/** Return counts accumulated since the last drain and reset them (called by the flusher). */
export function drainForFlush(): MetricsDelta {
  const delta: MetricsDelta = {
    requests: { ...pendingRequests },
    cache: { ...pendingCache },
    peak: peakSinceFlush,
  };
  (Object.keys(pendingRequests) as NsRequestKind[]).forEach((k) => { pendingRequests[k] = 0; });
  (Object.keys(pendingCache) as CacheEvent[]).forEach((k) => { pendingCache[k] = 0; });
  peakSinceFlush = 0;
  return delta;
}

/** Point-in-time snapshot (consumed by the future admin metrics dashboard). */
export function getMetricsSnapshot() {
  const lookups = cacheEvents.hit + cacheEvents.miss + cacheEvents.stale;
  const hitRate = lookups > 0 ? (cacheEvents.hit + cacheEvents.stale) / lookups : 0;
  return {
    sinceIso: new Date(startedAtMs).toISOString(),
    uptimeMs: Date.now() - startedAtMs,
    netsuite: {
      totalRequests,
      byKind: { ...requestCounts },
      peakConcurrency,
    },
    cache: {
      ...cacheEvents,
      lookups,
      hitRate: Number(hitRate.toFixed(4)),
    },
  };
}
