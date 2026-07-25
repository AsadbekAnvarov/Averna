/**
 * AI Guard — rate limits, response caching and request de-duplication for every
 * model-backed endpoint.
 *
 * Why: each AI route called GPT-4o on every request with no ceiling. On a public
 * site that is an unbounded spend and a "denial of wallet" vector — one user (or
 * a script) can burn the month's budget in minutes.
 *
 * Scope & honesty: this is an in-process guard (per serverless instance), not a
 * distributed one. It reliably stops the realistic abuse pattern — rapid-fire
 * requests, which land on a warm instance — and removes duplicate spend, with
 * zero new infrastructure and no schema change. A hard cross-instance ceiling
 * needs a shared store (Redis or a counter table); tracked as follow-up.
 */

interface Window {
  hits: number[];
}

const windows = new Map<string, Window>();

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Keep the maps from growing without bound on long-lived instances. */
const MAX_KEYS = 5000;

function prune<T>(map: Map<string, T>) {
  if (map.size <= MAX_KEYS) return;
  const excess = map.size - MAX_KEYS;
  let i = 0;
  for (const k of map.keys()) {
    map.delete(k);
    if (++i >= excess) break;
  }
}

export interface RouteLimit {
  /** Max requests per hour, per user. */
  perHour: number;
  /** Max requests per day, per user. */
  perDay: number;
}

/**
 * Per-route ceilings. Generous for honest use (a motivated student won't notice)
 * and tight enough that scripted abuse can't run away with the budget.
 */
export const AI_LIMITS: Record<string, RouteLimit> = {
  "averna-ai": { perHour: 30, perDay: 150 },
  "mentor-chat": { perHour: 30, perDay: 150 },
  roleplay: { perHour: 40, perDay: 200 },
  xray: { perHour: 15, perDay: 60 },
  podcast: { perHour: 4, perDay: 8 },
  "admin-briefing": { perHour: 10, perDay: 40 },
  "generate-test": { perHour: 20, perDay: 80 },
  "teacher-tool": { perHour: 30, perDay: 150 },
};

const DEFAULT_LIMIT: RouteLimit = { perHour: 20, perDay: 100 };

function countWithin(key: string, windowMs: number, now: number): number {
  const w = windows.get(key);
  if (!w) return 0;
  return w.hits.filter((t) => now - t < windowMs).length;
}

export interface GuardResult {
  ok: boolean;
  /** Student/teacher-facing message when blocked. */
  message?: string;
  retryAfterSeconds?: number;
}

/**
 * Check and record one AI request for a user on a route. Call this BEFORE the
 * model call; when it returns `ok: false`, respond 429 with `message`.
 */
export function guardAi(userId: string, route: string): GuardResult {
  const limit = AI_LIMITS[route] ?? DEFAULT_LIMIT;
  const now = Date.now();
  const key = `${route}:${userId}`;

  const hour = countWithin(key, 3_600_000, now);
  const day = countWithin(key, 86_400_000, now);

  if (hour >= limit.perHour) {
    return {
      ok: false,
      message: "You've used a lot of AI help in the last hour — take a short break and try again soon.",
      retryAfterSeconds: 600,
    };
  }
  if (day >= limit.perDay) {
    return {
      ok: false,
      message: "You've reached today's AI limit. It resets tomorrow — your learning data is all still here.",
      retryAfterSeconds: 3600,
    };
  }

  const w = windows.get(key) ?? { hits: [] };
  // Drop anything older than a day so the array can't grow unbounded.
  w.hits = w.hits.filter((t) => now - t < 86_400_000);
  w.hits.push(now);
  windows.set(key, w);
  prune(windows);

  return { ok: true };
}

/**
 * Cache an AI result and collapse concurrent identical requests into one model
 * call. `key` should include the user and a fingerprint of the data the answer
 * depends on, so a stale answer can never be served after the data changes.
 */
export async function cachedAi<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await produce();
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      prune(cache);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Convenience: a stable day stamp for cache keys that should refresh daily. */
export function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
