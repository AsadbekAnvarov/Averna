/** Pure policy helpers shared by the limiter and its regression tests. */
export interface WindowPolicy {
  key: string;
  limit: number;
  seconds: number;
}
export function fixedWindow(p: WindowPolicy, now = Date.now()) {
  if (
    !Number.isInteger(p.limit) ||
    p.limit < 1 ||
    !Number.isInteger(p.seconds) ||
    p.seconds < 1
  )
    throw new Error("Invalid rate policy");
  const windowMs = p.seconds * 1000;
  const start = Math.floor(now / windowMs) * windowMs;
  return {
    start,
    expiresAt: new Date(start + windowMs),
    retryAfterSeconds: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
  };
}
export function clientAddress(headers: Headers): string {
  // Hosts must strip untrusted forwarding headers at the edge (see the rollout runbook).
  return (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 100);
}
