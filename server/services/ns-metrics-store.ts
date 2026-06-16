/**
 * Persists the in-process NetSuite metrics (ns-metrics.ts) into per-minute
 * Postgres buckets (ns_metrics) so the admin dashboard has history and so counts
 * aggregate across Replit autoscale instances (each instance flushes its own
 * delta with an atomic upsert-increment).
 */
import { db } from '../db';
import { nsMetrics, type NsMetricsRow } from '@shared/schema';
import { sql, gte, lt } from 'drizzle-orm';
import { drainForFlush } from './ns-metrics';

const FLUSH_INTERVAL_MS = 60_000;
// Keep enough history that the day/week/month rollups are meaningful, not just
// the per-minute view. Per-minute rows are tiny so this stays well-bounded.
const RETENTION_DAYS = 120;

let timer: NodeJS.Timeout | null = null;
let flushTicks = 0;

/** Current wall-clock minute, seconds/ms zeroed — the bucket key. */
function currentMinuteBucket(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

async function flushOnce(): Promise<void> {
  const delta = drainForFlush();
  const totalReq =
    delta.requests.token + delta.requests.suiteql + delta.requests.record +
    delta.requests.restlet + delta.requests.oidc + delta.requests.other;
  const totalCache = delta.cache.hit + delta.cache.miss + delta.cache.stale;

  // Nothing happened this minute — don't write an empty row.
  if (totalReq === 0 && totalCache === 0 && delta.peak === 0) return;

  const bucket = currentMinuteBucket();
  await db.insert(nsMetrics).values({
    bucket,
    reqToken: delta.requests.token,
    reqSuiteql: delta.requests.suiteql,
    reqRecord: delta.requests.record,
    reqRestlet: delta.requests.restlet,
    reqOidc: delta.requests.oidc,
    reqOther: delta.requests.other,
    cacheHit: delta.cache.hit,
    cacheMiss: delta.cache.miss,
    cacheStale: delta.cache.stale,
    peakConcurrency: delta.peak,
  }).onConflictDoUpdate({
    target: nsMetrics.bucket,
    set: {
      reqToken: sql`${nsMetrics.reqToken} + ${delta.requests.token}`,
      reqSuiteql: sql`${nsMetrics.reqSuiteql} + ${delta.requests.suiteql}`,
      reqRecord: sql`${nsMetrics.reqRecord} + ${delta.requests.record}`,
      reqRestlet: sql`${nsMetrics.reqRestlet} + ${delta.requests.restlet}`,
      reqOidc: sql`${nsMetrics.reqOidc} + ${delta.requests.oidc}`,
      reqOther: sql`${nsMetrics.reqOther} + ${delta.requests.other}`,
      cacheHit: sql`${nsMetrics.cacheHit} + ${delta.cache.hit}`,
      cacheMiss: sql`${nsMetrics.cacheMiss} + ${delta.cache.miss}`,
      cacheStale: sql`${nsMetrics.cacheStale} + ${delta.cache.stale}`,
      // Peak is a max, not a sum.
      peakConcurrency: sql`GREATEST(${nsMetrics.peakConcurrency}, ${delta.peak})`,
    },
  });
}

/** Start the 60s flush loop (idempotent). Call once at server startup. */
export function startMetricsFlusher(): void {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      await flushOnce();
      // Prune roughly hourly so the table stays bounded.
      if (++flushTicks % 60 === 0) {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await db.delete(nsMetrics).where(lt(nsMetrics.bucket, cutoff));
      }
    } catch (err) {
      console.error('Metrics flush failed:', err);
    }
  }, FLUSH_INTERVAL_MS);
  // Don't keep the process alive solely for metrics.
  if (typeof timer.unref === 'function') timer.unref();
}

/** Per-minute buckets for the last `hours` hours, oldest first. */
export async function getMetricsTimeSeries(hours: number): Promise<NsMetricsRow[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db.select().from(nsMetrics).where(gte(nsMetrics.bucket, since)).orderBy(nsMetrics.bucket);
}

export type Granularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

// How far back to look for each granularity (in hours). Bounded by RETENTION_DAYS.
const LOOKBACK_HOURS: Record<Granularity, number> = {
  minute: 2,
  hour: 48,
  day: 24 * 30,
  week: 24 * 120,
  month: 24 * 120,
};

/**
 * Per-bucket rollup at the requested granularity, oldest first. The per-minute
 * rows are aggregated server-side with date_trunc (sums for counts, max for the
 * peak-concurrency high-water mark).
 */
export async function getMetricsRollup(granularity: Granularity): Promise<NsMetricsRow[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS[granularity] * 60 * 60 * 1000);

  if (granularity === 'minute') {
    return getMetricsTimeSeries(LOOKBACK_HOURS.minute);
  }

  const result = await db.execute(sql`
    SELECT
      date_trunc(${granularity}, bucket) AS bucket,
      SUM(req_token)::int        AS "reqToken",
      SUM(req_suiteql)::int      AS "reqSuiteql",
      SUM(req_record)::int       AS "reqRecord",
      SUM(req_restlet)::int      AS "reqRestlet",
      SUM(req_oidc)::int         AS "reqOidc",
      SUM(req_other)::int        AS "reqOther",
      SUM(cache_hit)::int        AS "cacheHit",
      SUM(cache_miss)::int       AS "cacheMiss",
      SUM(cache_stale)::int      AS "cacheStale",
      MAX(peak_concurrency)::int AS "peakConcurrency"
    FROM ns_metrics
    WHERE bucket >= ${since}
    GROUP BY 1
    ORDER BY 1
  `);

  return (result.rows as any[]).map((r) => ({
    bucket: new Date(r.bucket),
    reqToken: r.reqToken,
    reqSuiteql: r.reqSuiteql,
    reqRecord: r.reqRecord,
    reqRestlet: r.reqRestlet,
    reqOidc: r.reqOidc,
    reqOther: r.reqOther,
    cacheHit: r.cacheHit,
    cacheMiss: r.cacheMiss,
    cacheStale: r.cacheStale,
    peakConcurrency: r.peakConcurrency,
  })) as NsMetricsRow[];
}
