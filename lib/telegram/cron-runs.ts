/**
 * Admin → Telegram cron history: what a CronRun row means. Pure — admin.ts
 * reads the rows with it, and the (client) panel shows cronRunView's Uzbek
 * label, tone and detail lines, so a run that sent nothing isn't just a ✓.
 */

import type { CronRunCounts, CronRunInfo } from "./types";

const COUNT_KEYS = ["messages", "sent", "failed", "blocked", "capped", "deleted"] as const;

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * A CronRun row → CronRunInfo. `now` / `staleMs` (lib/cron/once STALE_RUN_MS):
 * a row still "running" that long after its last change is "interrupted".
 */
export function readCronRun(
  row: { job: string; day: string; status: string; details: unknown; updatedAt: Date | string },
  now: number,
  staleMs: number
): CronRunInfo {
  const d = row.details && typeof row.details === "object" && !Array.isArray(row.details) ? (row.details as Record<string, unknown>) : null;
  const counts: CronRunCounts = {};
  for (const k of COUNT_KEYS) {
    const v = d?.[k];
    if (typeof v === "number" && Number.isFinite(v)) counts[k] = Math.max(0, Math.round(v));
  }
  const changed = new Date(row.updatedAt).getTime();
  const valid = Number.isFinite(changed);
  return {
    job: row.job,
    day: row.day,
    status: row.status === "running" && valid && now - changed > staleMs ? "interrupted" : row.status,
    at: valid ? new Date(changed).toISOString() : "",
    error: row.status === "failed" ? text(d?.error, 300) : null,
    counts,
    errors: text(d?.errors, 200),
    skipped: text(d?.skipped, 200),
    more: d?.more === true,
  };
}

export type CronTone = "ok" | "warn" | "bad";

export interface CronRunView {
  /** Uzbek status label. */
  label: string;
  tone: CronTone;
  /** Uzbek detail lines under the label (counts, what failed …). */
  lines: string[];
}

/** telegram-daily loader names (details.errors). */
const PART: Record<string, string> = { admins: "adminlar", teachers: "oʻqituvchilar", parents: "ota-onalar", students: "oʻquvchilar" };

/**
 * How Admin → Telegram shows a run: done runs are judged by their counts —
 * nothing delivered while something failed or didn't fit → "bad"; some sends
 * failed / didn't fit, or a loader failed → "warn"; else ✓.
 */
export function cronRunView(run: CronRunInfo): CronRunView {
  switch (run.status) {
    case "failed":
      return { label: "xato", tone: "bad", lines: run.error ? [run.error] : [] };
    case "interrupted":
      return {
        label: "uzilib qolgan",
        tone: "bad",
        lines: [
          "Ish oxiriga yetmagan — ehtimol, vaqt chegarasida (60 s) toʻxtatilgan. Shu kuni cron yana ishga tushsa (masalan, ikkinchi loyihada), qayta bajariladi.",
        ],
      };
    case "running":
      return { label: "bajarilmoqda", tone: "warn", lines: [] };
    case "done":
      break;
    default:
      return { label: run.status, tone: "warn", lines: [] };
  }
  if (run.skipped) return { label: "oʻtkazib yuborildi", tone: "warn", lines: [run.skipped] };

  const c = run.counts ?? {};
  const failedParts = run.errors
    ? run.errors
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => PART[p] ?? p)
    : [];
  const lines: string[] = [];
  if (c.messages === 0 && !failedParts.length) {
    lines.push("yuboriladigan xabar yoʻq");
  } else {
    const parts: string[] = [];
    if (c.sent != null) parts.push(c.messages != null ? `yuborildi: ${c.sent} / ${c.messages}` : `yuborildi: ${c.sent}`);
    if (c.deleted != null) parts.push(`oʻchirildi: ${c.deleted}`);
    if (c.failed) parts.push(`xato: ${c.failed}`);
    if (c.blocked) parts.push(`botni bloklagan: ${c.blocked}`);
    if (c.capped) parts.push(`yuborilmay qoldi (vaqt/limit): ${c.capped}`);
    if (parts.length) lines.push(parts.join(" · "));
  }
  if (failedParts.length) lines.push(`Maʼlumot yuklanmadi: ${failedParts.join(", ")}`);
  if (run.more) lines.push("Qolgani keyingi ishga tushirishda davom etadi.");

  const delivered = c.sent ?? c.deleted;
  const trouble = (c.failed ?? 0) + (c.capped ?? 0) > 0 || failedParts.length > 0;
  if (trouble && delivered === 0) {
    return { label: c.sent != null ? "hech narsa yuborilmadi" : "hech narsa oʻchirilmadi", tone: "bad", lines };
  }
  if (trouble) return { label: "qisman bajarildi", tone: "warn", lines };
  return { label: "bajarildi", tone: "ok", lines };
}
