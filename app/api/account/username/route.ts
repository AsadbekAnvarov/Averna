import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setOwnUsername, usernameOf } from "@/lib/account/username";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The signed-in user's own username.
 *   GET                 → { username: string | null }
 *   POST { username }   → { ok: true, username } | { code }   (409 "taken" when another account has it)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ code: "auth" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ username: await usernameOf(session.user.id) }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ code: "auth" }, { status: 401, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as { username?: unknown } | null;
  const r = await setOwnUsername(session.user.id, body?.username, session.user.role);
  if (!r.ok) return NextResponse.json({ code: r.code }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ ok: true, username: r.username }, { headers: NO_STORE });
}
