import { db } from "@/lib/db";

/**
 * Records an admin/teacher action in the audit log. Never throws.
 */
export async function recordAudit(
  actor: { id: string; name?: string | null; role?: string | null },
  action: string,
  detail?: string
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name ?? "Unknown",
        role: actor.role ?? "USER",
        action,
        detail: detail ?? null,
      },
    });
  } catch (e) {
    console.error("recordAudit failed:", e);
  }
}
