/** Shared fixed-window AI limits + per-instance response deduplication.
 * Limit reservations are atomic in PostgreSQL across all instances. The global
 * ceiling limits requests, not dollars: audio rendering and dual-task exams can
 * make several model calls per request. Configure billing limits at the provider too.
 */

import { reserveLimits } from "@/lib/security/rate-limit";

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
  // Exam-format assessment: when exhausted, scoring falls back to heuristics
  // (the attempt is still saved) — never a failed submission.
  "speaking-test": { perHour: 6, perDay: 20 },
  "writing-submit": { perHour: 8, perDay: 24 },
  "writing-exam": { perHour: 8, perDay: 24 },
  // Admin bulk generator: one request = one passage / part / task. Filling the
  // library to 70 per skill is ~700 steps (Reading 3, Listening 4, others 1).
  "exam-gen": { perHour: 200, perDay: 1000 },
  // Dictionary lookups that miss the cache (cached words cost nothing).
  dictionary: { perHour: 120, perDay: 400 },
  // Admin: rendering one Listening part (≈ 40–70 text-to-speech calls) per request.
  "listening-audio": { perHour: 60, perDay: 400 },
  // One recorded Speaking answer = one transcription (a full test ≈ 15).
  "speaking-answer": { perHour: 90, perDay: 300 },
  // Placement test writing sample (one AI assessment per sitting).
  placement: { perHour: 6, perDay: 12 },
};

const DEFAULT_LIMIT: RouteLimit = { perHour: 20, perDay: 100 };

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
export async function guardAi(userId: string, route: string): Promise<GuardResult> {
  const limit = AI_LIMITS[route] ?? DEFAULT_LIMIT;
  const globalDaily = Math.max(1, Number.parseInt(process.env.AI_DAILY_REQUEST_LIMIT || "2000", 10) || 2000);
  const result = await reserveLimits([
    { key: `ai:${route}:${userId}:hour`, limit: limit.perHour, seconds: 3600 },
    { key: `ai:${route}:${userId}:day`, limit: limit.perDay, seconds: 86400 },
    { key: "ai:platform:day", limit: globalDaily, seconds: 86400 },
  ]);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    message: result.unavailable
      ? "AI help is temporarily unavailable. Your learning data is safe — please try again shortly."
      : "The AI request limit has been reached. Your learning data is safe — please try again later.",
    retryAfterSeconds: result.retryAfterSeconds,
  };
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
