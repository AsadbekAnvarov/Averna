import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkUsername } from "@/lib/account/username";

export const dynamic = "force-dynamic";

/**
 * GET ?u=<username> → { username, available: true } | { username, available: false, code }
 *
 * Live "is it free?" for the sign-up form (no session needed) and the profile
 * forms (the user's own current username counts as free). Limited per IP.
 */

const PER_MINUTE = 60;
const hits = new Map<string, number[]>();

function tooMany(key: string, now: number): boolean {
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= PER_MINUTE) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return false;
}

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (tooMany(ip, Date.now())) return NextResponse.json({ available: false, code: "too_many" }, { status: 429, headers });

  const session = await auth().catch(() => null);
  const r = await checkUsername(req.nextUrl.searchParams.get("u") ?? "", {
    userId: session?.user?.id ?? null,
    allowReserved: session?.user?.role === "ADMIN",
  });
  if (r.ok) return NextResponse.json({ username: r.username, available: true }, { headers });
  return NextResponse.json({ username: r.username, available: false, code: r.code }, { status: r.code === "server" ? 500 : 200, headers });
}
