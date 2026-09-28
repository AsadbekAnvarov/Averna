import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { changePassword } from "@/lib/account/password";

export const dynamic = "force-dynamic";

/**
 * POST { currentPassword, newPassword } → { ok: true } | { code }
 *
 * Changes the signed-in user's own password (lib/account/password). The
 * response carries a code, not a sentence: the form shows it in the page's
 * language. Afterwards every session of the account ends, this one included,
 * and the user signs in with the new password.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ code: "auth" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const r = await changePassword(session.user.id, body?.currentPassword, body?.newPassword);
  if (!r.ok) return NextResponse.json({ code: r.code }, { status: r.status, headers: { "Cache-Control": "no-store" } });

  if (session.user.role === "ADMIN" || session.user.role === "TEACHER") {
    await recordAudit({ id: session.user.id, name: session.user.name, role: session.user.role }, "Changed own password");
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
