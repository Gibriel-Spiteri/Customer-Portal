/**
 * Read-through cache for NetSuite responses, backed by Postgres (ns_cache table).
 *
 * Strategy: stale-while-revalidate with two horizons per entry.
 *   - now < softExpiresAt  -> FRESH: serve cached, 0 NetSuite calls.
 *   - soft <= now < hard   -> STALE: serve cached immediately AND kick a
 *                             background refresh (deduped per key).
 *   - now >= hardExpiresAt  -> EXPIRED: block, fetch (loader uses nsLimit), store.
 *   - loader error          -> serve last cached payload if present (serve-stale-on-error).
 *
 * Why Postgres (not in-memory): on Replit autoscale the cache is shared across
 * instances and survives scale-to-zero. Each lookup is a cheap DB round-trip that
 * does NOT consume the NetSuite concurrency budget — so cache hits make the cap-3
 * limiter effectively never bind.
 *
 * Because there is no NetSuite-side push invalidation, freshness is purely TTL:
 * volatile data uses short TTLs, immutable/historical data uses long ones, and
 * record detail picks its TTL from the record's own state (closed -> long).
 */
import { db } from '../db';
import { nsCache } from '@shared/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { recordCache } from './ns-metrics';

export interface CacheTier {
  softMs: number;
  hardMs: number;
}

/** A fixed tier, or a function that picks a tier from the loaded value (state-based TTL). */
export type TtlSpec<T> = CacheTier | ((value: T) => CacheTier);

/** TTL tiers. Tune here. (Account-wide concurrency budget context in ns-limit.ts.) */
export const TTL = {
  // Volatile: statuses, list contents, counts, balances. New records must appear
  // reasonably quickly and there is no push invalidation, so keep this short.
  VOLATILE: { softMs: 60_000, hardMs: 5 * 60_000 }, // serve 1m, hard 5m
  // Immutable/historical: closed orders, past invoices/payments, closed cases.
  HISTORY: { softMs: 60 * 60_000, hardMs: 24 * 60 * 60_000 }, // serve 1h, hard 24h
  // Rarely-changing reference (e.g. contacts).
  PROFILE: { softMs: 60 * 60_000, hardMs: 24 * 60 * 60_000 },
} as const;

function resolveTier<T>(ttl: TtlSpec<T>, value: T): CacheTier {
  return typeof ttl === 'function' ? ttl(value) : ttl;
}

// Per-key, per-process single-flight so a burst of identical misses (or stale
// revalidations) collapses to one loader call instead of N NetSuite hits.
const inFlight = new Map<string, Promise<any>>();

export interface CachedArgs<T> {
  key: string;
  /** Owning customer id for invalidate-by-customer. May be derived from the loaded
   *  value (detail fetches don't know the customer until the record comes back). */
  customerId: string | ((value: T) => string);
  entityType: string;
  ttl: TtlSpec<T>;
  loader: () => Promise<T>;
  /** Bypass the cache and force a refresh (writes the fresh value back). */
  force?: boolean;
}

export async function cached<T>(args: CachedArgs<T>): Promise<T> {
  const { key, customerId, entityType, ttl, loader, force } = args;
  const now = Date.now();

  if (!force) {
    const rows = await db.select().from(nsCache).where(eq(nsCache.cacheKey, key)).limit(1);
    const hit = rows[0];
    if (hit && now < hit.hardExpiresAt.getTime()) {
      if (now >= hit.softExpiresAt.getTime()) {
        // Stale: serve now, revalidate in the background (deduped, errors ignored).
        recordCache('stale');
        void refresh({ key, customerId, entityType, ttl, loader }).catch(() => {});
      } else {
        recordCache('hit');
      }
      return hit.payload as T;
    }
  }

  recordCache('miss');
  return refresh({ key, customerId, entityType, ttl, loader });
}

function refresh<T>(args: {
  key: string;
  customerId: string | ((value: T) => string);
  entityType: string;
  ttl: TtlSpec<T>;
  loader: () => Promise<T>;
}): Promise<T> {
  const { key, customerId, entityType, ttl, loader } = args;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async (): Promise<T> => {
    try {
      const value = await loader();
      const now = Date.now();
      const tier = resolveTier(ttl, value);
      const resolvedCustomerId = typeof customerId === 'function' ? customerId(value) : customerId;
      const row = {
        cacheKey: key,
        customerId: resolvedCustomerId,
        entityType,
        payload: value as any,
        fetchedAt: new Date(now),
        softExpiresAt: new Date(now + tier.softMs),
        hardExpiresAt: new Date(now + tier.hardMs),
      };
      await db.insert(nsCache).values(row).onConflictDoUpdate({
        target: nsCache.cacheKey,
        set: {
          payload: row.payload,
          fetchedAt: row.fetchedAt,
          softExpiresAt: row.softExpiresAt,
          hardExpiresAt: row.hardExpiresAt,
        },
      });
      return value;
    } catch (err) {
      recordCache('error');
      // Serve-stale-on-error: if we still have any cached payload, return it
      // rather than failing the request (NetSuite may just be briefly down).
      const rows = await db.select().from(nsCache).where(eq(nsCache.cacheKey, key)).limit(1);
      if (rows[0]) return rows[0].payload as T;
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}

/** Drop one cache entry. */
export async function invalidateKey(key: string): Promise<void> {
  await db.delete(nsCache).where(eq(nsCache.cacheKey, key));
}

/**
 * Drop a customer's cache. Pass entityTypes to scope it (e.g. ['orders','account']);
 * omit to clear everything for that customer. Used by the manual refresh endpoint.
 */
export async function invalidateCustomer(customerId: string, entityTypes?: string[]): Promise<void> {
  if (entityTypes && entityTypes.length > 0) {
    await db.delete(nsCache).where(
      and(eq(nsCache.customerId, customerId), inArray(nsCache.entityType, entityTypes)),
    );
  } else {
    await db.delete(nsCache).where(eq(nsCache.customerId, customerId));
  }
}

/** Housekeeping: delete hard-expired rows. Safe to call from a periodic job. */
export async function sweepExpired(): Promise<void> {
  await db.delete(nsCache).where(lt(nsCache.hardExpiresAt, new Date()));
}
