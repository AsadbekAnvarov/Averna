import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createUserLinkCode, getLinkStatus, unlinkUser, updateUserPrefs } from "@/lib/telegram/links";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's Telegram link (Settings → Telegram).
 *
 *   GET     status + preferences (polled while the user presses Start in Telegram)
 *   POST    a fresh one-time code → { url: https://t.me/<bot>?start=<code>, expiresAt } (15 min)
 *   PATCH   { prefs: { homework?, reviews?, reminders?, reports? } } → { ok, prefs }
 *   DELETE  disconnect
 *
 * Students, teachers and admins only (parents are invited by a teacher).
 */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function signedIn(): Promise<{ id: string; role: string | null } | null> {
  try {
    const u = await requireAuth();
    return u?.id ? { id: String(u.id), role: u.role ? String(u.role) : null } : null;
  } catch {
    return null;
  }
}

const SIGNED_OUT = "Your session has expired — sign in again.";

export async function GET() {
  const user = await signedIn();
  if (!user) return json({ error: SIGNED_OUT }, 401);
  try {
    return json(await getLinkStatus(user));
  } catch (e) {
    console.error("Telegram link status failed:", e);
    return json({ error: "Couldn't load your Telegram connection. Please try again." }, 500);
  }
}

export async function POST() {
  const user = await signedIn();
  if (!user) return json({ error: SIGNED_OUT }, 401);
  try {
    const r = await createUserLinkCode(user);
    if (!r.ok) return json({ error: r.error, code: r.code }, r.status);
    return json({ url: r.url, expiresAt: r.expiresAt });
  } catch (e) {
    console.error("Telegram link code failed:", e);
    return json({ error: "Couldn't create a Telegram link. Please try again." }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await signedIn();
  if (!user) return json({ error: SIGNED_OUT }, 401);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "Send the preferences as JSON." }, 415);
  }
  const body: unknown = await req.json().catch(() => null);
  try {
    const r = await updateUserPrefs(user.id, body);
    if (!r.ok) return json({ error: r.error, code: r.code }, r.status);
    return json({ ok: true, prefs: r.prefs });
  } catch (e) {
    console.error("Telegram prefs update failed:", e);
    return json({ error: "Couldn't save your Telegram settings. Please try again." }, 500);
  }
}

export async function DELETE() {
  const user = await signedIn();
  if (!user) return json({ error: SIGNED_OUT }, 401);
  try {
    await unlinkUser(user.id);
    return json({ ok: true });
  } catch (e) {
    console.error("Telegram unlink failed:", e);
    return json({ error: "Couldn't disconnect Telegram. Please try again." }, 500);
  }
}
