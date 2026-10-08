import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { fixedWindow, type WindowPolicy } from "./rate-policy";

export type LimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; unavailable?: boolean };
class Exhausted extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Rate limit exceeded");
  }
}

/** Atomic across serverless instances. A denied multi-window request consumes no slots. */
export async function reserveLimits(
  policies: WindowPolicy[],
  now = Date.now(),
): Promise<LimitResult> {
  if (!policies.length) return { ok: true };
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    return { ok: false, retryAfterSeconds: 60, unavailable: true };
  const windows = policies
    .map((policy) => {
      const window = fixedWindow(policy, now);
      const id = createHmac("sha256", secret || "local-only-rate-key")
        .update(`${policy.key}:${policy.seconds}:${window.start}`)
        .digest("hex");
      return { ...policy, ...window, id };
    })
    .sort((a, b) => a.id.localeCompare(b.id)); // deterministic lock order avoids deadlocks
  try {
    await db.$transaction(async (tx) => {
      for (const w of windows) {
        const rows = await tx.$queryRaw<{ hits: number }[]>`
          INSERT INTO "rate_limit_buckets" ("id", "hits", "expiresAt")
          VALUES (${w.id}, 1, ${w.expiresAt})
          ON CONFLICT ("id") DO UPDATE SET "hits" = "rate_limit_buckets"."hits" + 1
          WHERE "rate_limit_buckets"."hits" < ${w.limit}
          RETURNING "hits"`;
        if (!rows.length) throw new Exhausted(w.retryAfterSeconds);
      }
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Exhausted)
      return { ok: false, retryAfterSeconds: e.retryAfterSeconds };
    console.error(
      "Shared rate limiter unavailable",
      e instanceof Error ? e.name : "unknown",
    );
    // Do not fall back to unlimited paid calls or unlimited password guesses.
    return { ok: false, retryAfterSeconds: 60, unavailable: true };
  }
}
