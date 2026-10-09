import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { guardAi } from "@/lib/engine/ai-guard";
import { blobConfigured } from "@/lib/storage/blob";
import { audioAiConfigured } from "@/lib/openai-audio";
import { RenderError } from "@/lib/ielts/audio/render";
import { StoreError, currentPartInfo, renderAndStore, resolveAudioTest, shortError } from "@/lib/ielts/audio/store";
import type { AudioErrorBody, AudioErrorCode, RenderOk } from "@/lib/ielts/audio/admin-types";

export const dynamic = "force-dynamic";
// One part = ~20–50 text-to-speech requests (≤ 40 s) + the upload.
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

function fail(status: number, code: AudioErrorCode, error: string, extra: Partial<AudioErrorBody> = {}) {
  const body: AudioErrorBody = { ok: false, error, code, ...extra };
  return json(body, status);
}

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return fail(signedOut ? 401 : 403, "invalid", signedOut ? "Tizimga kiring." : "Faqat oʻqituvchi va administratorlar uchun.");
}

/** Parts being rendered on this instance — a double click must not render (and pay for) a part twice. */
const inFlight = new Set<string>();

/**
 * POST { testId, partIndex } — render one part with OpenAI voices, upload it
 * to Vercel Blob and record it. `testId` is a catalog test or the placement
 * test's Listening (resolveAudioTest). 429 { error, retryAfterSec } when the AI
 * limit (or OpenAI's) is reached: the admin queue waits and carries on by itself.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let user: { id: string };
  try {
    user = (await requireTeacherOrAdmin()) as { id: string };
  } catch (e) {
    return authError(e);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const testId = typeof body?.testId === "string" ? body.testId.trim() : "";
  const partIndex = typeof body?.partIndex === "number" ? body.partIndex : NaN;
  if (!testId || testId.length > 200 || !Number.isInteger(partIndex) || partIndex < 0 || partIndex > 9) {
    return fail(400, "invalid", "Notoʻgʻri soʻrov: testId va partIndex kerak.");
  }
  if (!blobConfigured()) return fail(400, "config", "Vercel Blob ulanmagan — BLOB_READ_WRITE_TOKEN sozlanmagan.");
  if (!audioAiConfigured()) return fail(400, "config", "OPENAI_API_KEY sozlanmagan — ovoz yaratib boʻlmaydi.");

  const test = await resolveAudioTest(testId);
  if (!test) return fail(404, "not_found", "Test topilmadi (u katalogdan olib tashlangan boʻlishi mumkin).");
  if (test.source === "legacy") return fail(400, "invalid", "Eski qisqa mashq testlari uchun audio yaratilmaydi.");
  if (!test.parts[partIndex]) return fail(400, "invalid", `Bu testda ${partIndex + 1}-qism yoʻq.`);

  const key = `${test.id}#${partIndex}`;
  if (inFlight.has(key)) return fail(409, "busy", "Bu qism hozir yaratilmoqda — biroz kuting.");

  const guard = await guardAi(user.id, "listening-audio");
  if (!guard.ok) {
    const wait = guard.retryAfterSeconds ?? 600;
    return fail(429, "rate_limit", `AI limiti tugadi — taxminan ${Math.max(1, Math.round(wait / 60))} daqiqadan keyin davom etadi.`, {
      retryAfterSec: wait,
    });
  }

  inFlight.add(key);
  try {
    const { part } = await renderAndStore(test, partIndex, startedAt);
    const ok: RenderOk = { ok: true, part, seconds: Math.round((Date.now() - startedAt) / 100) / 10 };
    return json(ok);
  } catch (e) {
    const part = await currentPartInfo(test, partIndex).catch(() => undefined);
    const detail = shortError(e);
    if (e instanceof RenderError) {
      switch (e.kind) {
        case "rate_limit":
          return fail(429, "rate_limit", "OpenAI soʻrovlar limitiga yetildi — biroz kutib, avtomatik davom etadi.", {
            retryAfterSec: e.retryAfterSec ?? 60,
            part,
          });
        case "config":
          return fail(400, "config", `OpenAI sozlamalarini tekshiring: ${detail}`, { part });
        case "timeout":
          return fail(504, "timeout", "Ovoz yaratish juda uzoq davom etdi — qayta urinib koʻring (tayyor qatorlar saqlanib turadi).", { part });
        case "audio":
          return fail(502, "audio", `Audio faylini yigʻib boʻlmadi: ${detail}`, { part });
        case "invalid":
          return fail(400, "invalid", `Bu qismni oʻqib boʻlmadi: ${detail}`, { part });
        default:
          return fail(502, "upstream", `OpenAI xatosi: ${detail}`, { part });
      }
    }
    if (e instanceof StoreError && e.code === "storage") {
      return fail(502, "storage", `Faylni Vercel Blob xotirasiga yuklab boʻlmadi: ${detail}`, { part });
    }
    console.error("listening-audio render failed", e);
    return fail(500, "server", `Server xatosi: ${detail}`, { part });
  } finally {
    inFlight.delete(key);
  }
}
