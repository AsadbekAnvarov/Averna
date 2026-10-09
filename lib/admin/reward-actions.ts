"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { MAX_LEVEL } from "@/lib/engine/progression/levels";

export async function setRewardAvailability(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const action = formData.get("action");
  if (!id || (action !== "remove" && action !== "restore")) throw new Error("Invalid reward action");
  // Archive rather than cascade-delete: pending requests and spent-point history
  // must remain reviewable, including after a catalog removal.
  const active = action === "restore";
  const result = await db.reward.updateMany({ where: { id, active: !active }, data: { active } });
  if (result.count > 0) await recordAudit(actor, active ? "Restored reward" : "Removed reward from catalog", `rewardId=${id}`);
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
}

export async function updateReward(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const cost = Number(formData.get("cost"));
  const minLevel = Number(formData.get("minLevel"));
  if (!id || !name || name.length > 200 || !Number.isSafeInteger(cost) || cost < 1 || cost > 2147483647 || !Number.isInteger(minLevel) || minLevel < 1 || minLevel > MAX_LEVEL) throw new Error("Invalid reward fields");
  await db.reward.update({ where: { id }, data: { name, cost, minLevel, description: String(formData.get("description") ?? "").trim() || null, icon: String(formData.get("icon") ?? "").trim() || "🎁" } });
  await recordAudit(actor, "Updated reward", `rewardId=${id}`);
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
}
