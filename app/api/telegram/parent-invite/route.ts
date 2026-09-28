import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { createParentInvite, parentInviteStatus, removeParentLink } from "@/lib/telegram/links";

export const dynamic = "force-dynamic";

/**
 * Parent invites to the Telegram bot (teacher's parent report page).
 *
 *   GET    ?studentId=           → { available, linkedParents, parents: [{ id, firstName, username, linkedAt, active }] }
 *   POST   { studentId }         → { url, expiresAt, studentName } — one parent, 7 days, single use
 *   DELETE { studentId, linkId } → { ok } — remove one of this student's parent links
 *          (or ?studentId=&linkId=)
 *
 * Only a teacher of the student's group or an admin (lib/access canReviewStudent).
 */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function staff(): Promise<{ id: string; role: string } | { error: string; status: number }> {
  try {
    const u = await requireTeacherOrAdmin();
    return { id: String(u.id), role: String(u.role) };
  } catch (e) {
    const forbidden = e instanceof Error && e.message.startsWith("Forbidden");
    return forbidden
      ? { error: "Only teachers and admins can invite parents.", status: 403 }
      : { error: "Your session has expired — sign in again.", status: 401 };
  }
}

export async function GET(req: NextRequest) {
  const viewer = await staff();
  if ("error" in viewer) return json({ error: viewer.error }, viewer.status);
  try {
    const r = await parentInviteStatus(viewer, req.nextUrl.searchParams.get("studentId"));
    if (!r.ok) return json({ error: r.error, code: r.code }, r.status);
    return json({ available: r.available, linkedParents: r.linkedParents, parents: r.parents });
  } catch (e) {
    console.error("Telegram parent invite status failed:", e);
    return json({ error: "Couldn't load the Telegram status. Please try again." }, 500);
  }
}

export async function POST(req: NextRequest) {
  const viewer = await staff();
  if ("error" in viewer) return json({ error: viewer.error }, viewer.status);
  const body: unknown = await req.json().catch(() => null);
  const studentId = body && typeof body === "object" ? (body as { studentId?: unknown }).studentId : undefined;
  try {
    const r = await createParentInvite(viewer, studentId);
    if (!r.ok) return json({ error: r.error, code: r.code }, r.status);
    return json({ url: r.url, expiresAt: r.expiresAt, studentName: r.studentName });
  } catch (e) {
    console.error("Telegram parent invite failed:", e);
    return json({ error: "Couldn't create the invite. Please try again." }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const viewer = await staff();
  if ("error" in viewer) return json({ error: viewer.error }, viewer.status);
  const body: unknown = await req.json().catch(() => null);
  const rec = body && typeof body === "object" ? (body as { studentId?: unknown; linkId?: unknown }) : {};
  const params = req.nextUrl.searchParams;
  try {
    const r = await removeParentLink(viewer, rec.studentId ?? params.get("studentId"), rec.linkId ?? params.get("linkId"));
    if (!r.ok) return json({ error: r.error, code: r.code }, r.status);
    return json({ ok: true });
  } catch (e) {
    console.error("Telegram parent link removal failed:", e);
    return json({ error: "Couldn't remove the parent connection. Please try again." }, 500);
  }
}
