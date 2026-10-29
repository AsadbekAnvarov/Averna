import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_CATALOG_TAG } from "@/lib/ielts/catalog";
import { boundaryInfoOf, resolveSegmentsTest } from "@/lib/ielts/audio/store";
import { validateSegments, windowsByPart } from "@/lib/ielts/segments";
import { segmentMessage } from "@/lib/ielts/segments-messages";
import { loadSegmentRecords, saveSegments } from "@/lib/ielts/segments-store";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

const ms = z.number().int().min(0).max(4 * 3_600_000);
const bodySchema = z
  .object({
    testId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    revision: z.number().int().min(0),
    confirm: z.boolean().default(true),
    segments: z.array(z.object({ startMs: ms, endMs: ms }).strict()).length(4),
    index: z
      .object({
        fileSha256: z.string().regex(/^[a-f0-9]{64}$/),
        sampleRate: z.number().int().refine((r) => [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(r)),
        samplesPerFrame: z.union([z.literal(576), z.literal(1152)]),
        ranges: z
          .array(
            z.object({ frameStart: ms, frameEnd: ms, byteStart: z.number().int().min(0), byteEnd: z.number().int().min(1) }).strict(),
          )
          .length(4),
      })
      .strict(),
  })
  .strict();

/**
 * PUT — save (and confirm) the part boundaries of a supplied whole recording.
 * Checks, in order: session (401) → role ADMIN/TEACHER (403) → body (400) →
 * the paper has a whole recording (404) → the boundary rules (422) → the
 * recording index matches the paper's recording (422) → the revision the
 * client loaded (409). Writes only listening_part_segments, never the paper
 * or its listening_audio row.
 */
export async function PUT(req: Request) {
  let user: { id: string };
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    const signedOut = e instanceof Error && e.message === "Unauthorized";
    return signedOut
      ? json({ error: segmentMessage("unauthorized"), code: "unauthorized" }, 401)
      : json({ error: segmentMessage("forbidden"), code: "forbidden" }, 403);
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: segmentMessage("invalid"), code: "invalid" }, 400);
  const body = parsed.data;

  const test = await resolveSegmentsTest(body.testId);
  if (!test || !test.recordingSha256 || !test.recordingDurationMs) return json({ error: segmentMessage("not-found"), code: "not-found" }, 404);

  const windows = windowsByPart(test);
  const violation = validateSegments(body.segments, { durationMs: test.recordingDurationMs, windowsByPart: windows });
  if (violation) return json({ error: segmentMessage(violation.rule, violation.part), code: violation.rule, part: violation.part }, 422);
  if (body.index.fileSha256 !== test.recordingSha256) return json({ error: segmentMessage("recording"), code: "recording" }, 422);

  try {
    const row = (await db.listeningAudio.findUnique({
      where: { testId_partIndex: { testId: test.id, partIndex: -1 } },
      select: { id: true, testId: true, partIndex: true, status: true, url: true, bytes: true, durationMs: true, scriptHash: true, voiceModel: true, error: true, updatedAt: true },
    })) as Parameters<typeof boundaryInfoOf>[1] | null;
    const outcome = await saveSegments({
      testId: test.id,
      revision: body.revision,
      confirm: body.confirm,
      actorId: user.id,
      segments: body.segments,
      ranges: body.index.ranges,
      sampleRate: body.index.sampleRate,
      samplesPerFrame: body.index.samplesPerFrame,
      fileSha256: body.index.fileSha256,
      recording: { sha256: test.recordingSha256, durationMs: test.recordingDurationMs, bytes: row?.bytes && row.bytes > 0 ? row.bytes : null },
      windowsByPart: windows,
    });
    if (!outcome.ok) {
      if (outcome.reason === "conflict") return json({ error: segmentMessage("conflict"), code: "conflict" }, 409);
      if (outcome.reason === "invalid") {
        return json({ error: segmentMessage(outcome.violation.rule, outcome.violation.part), code: outcome.violation.rule, part: outcome.violation.part }, 422);
      }
      return json({ error: segmentMessage("recording"), code: "recording" }, 422);
    }
    revalidateTag(EXAM_CATALOG_TAG);
    const rec = (await loadSegmentRecords([test.id])).get(test.id) ?? null;
    const me = (await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } }).catch(() => null)) as { name: string | null; email: string } | null;
    return json({
      ok: true,
      message: segmentMessage("saved"),
      boundaries: boundaryInfoOf(test, row ?? undefined, rec, me ? me.name?.trim() || me.email : null) ?? null,
    });
  } catch (e) {
    console.error("listening segments save failed", e);
    return json({ error: segmentMessage("server"), code: "server" }, 500);
  }
}
