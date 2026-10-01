/**
 * Listening audio storage — ListeningAudio rows + files in the (public)
 * Vercel Blob store. Used by the admin routes and page.
 *
 * - audioOverview: the placement test's Listening (lib/placement/content) and
 *   every catalog Listening test (legacy short tests and CDI tests — which
 *   ship real recordings — skipped; CDI is only counted) with each part's
 *   status (none / ready / stale / failed), size and length, plus recordings
 *   of tests that left the catalog, and storage totals.
 * - resolveAudioTest: the test behind an id the admin renders — a placement
 *   form's Listening test or a catalog test (as the placement test and the
 *   practice pages / mock resolve them).
 * - renderAndStore: render one part, upload it, upsert its row, delete the file
 *   it replaces. A failed render never destroys a recording that still works:
 *   it only notes the error; without a recording the row becomes "failed".
 * - deleteAudio: files first, then rows.
 *
 * SERVER ONLY.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { blobConfigured, deleteBlobs, putBlob } from "@/lib/storage/blob";
import { monthlyAudioUploadLimit, speakingStorageUsage } from "@/lib/speaking/recording";
import { TTS_MODEL, audioAiConfigured } from "@/lib/openai-audio";
import { PLACEMENT_FORMS } from "@/lib/placement/content";
import { getListeningExam, listListeningExams, listeningFromRow } from "../catalog";
import { CDI_LISTENING } from "../content/cdi";
import { estimatePartSeconds } from "../format";
import type { ExamListeningTest } from "../types";
import type { AudioOverview, OrphanAudioInfo, PartAudioInfo, PartAudioStatus, TestAudioInfo } from "./admin-types";
import { listeningAudioEnabled } from "./client";
import { partAudioHash } from "./hash";
import { fileProgramme } from "./programme";
import { RenderError, renderListeningPart } from "./render";
import type { RenderedPart } from "./render";

export interface AudioRow {
  id: string;
  testId: string;
  partIndex: number;
  status: string;
  url: string | null;
  bytes: number;
  durationMs: number;
  scriptHash: string;
  voiceModel: string;
  error: string | null;
  updatedAt: Date | string;
}

const ROW_SELECT = {
  id: true,
  testId: true,
  partIndex: true,
  status: true,
  url: true,
  bytes: true,
  durationMs: true,
  scriptHash: true,
  voiceModel: true,
  error: true,
  updatedAt: true,
} as const;

export class StoreError extends Error {
  constructor(
    readonly code: "storage" | "server",
    message: string
  ) {
    super(message);
    this.name = "StoreError";
  }
}

/** Where a part's file goes (the Blob store adds a random suffix). */
export function blobPath(testId: string, partIndex: number): string {
  const safe = testId.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80) || "test";
  return `listening/${safe}/part-${partIndex + 1}.mp3`;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function shortError(e: unknown): string {
  const m = e instanceof Error && e.message ? e.message : "Unknown error.";
  return m.replace(/\s+/g, " ").trim().slice(0, 300);
}

function statusOf(row: AudioRow | undefined, hash: string | null): PartAudioStatus {
  if (!row) return "none";
  if (row.status === "ready" && row.url) return hash && row.scriptHash === hash ? "ready" : "stale";
  if (row.status === "failed") return "failed";
  return "none";
}

export function partInfo(test: ExamListeningTest, index: number, row: AudioRow | undefined, model: string): PartAudioInfo {
  const part = test.parts[index];
  const programme = fileProgramme(test, index);
  const status = statusOf(row, partAudioHash(test, index, model));
  const hasFile = status === "ready" || status === "stale";
  return {
    index,
    title: part?.title || `Part ${index + 1}`,
    status,
    url: hasFile ? row?.url ?? null : null,
    bytes: hasFile ? row?.bytes ?? 0 : 0,
    durationMs: hasFile ? row?.durationMs ?? 0 : 0,
    error: row?.error ?? null,
    updatedAt: iso(row?.updatedAt),
    lines: programme ? programme.lines.filter((l) => String(l.text ?? "").trim()).length : 0,
    estimatedSeconds: part ? estimatePartSeconds(part) : 0,
  };
}

/** The test ships with its own real recording (CDI) — nothing to render with TTS. */
export function hasRealAudio(t: { source?: string; audio?: unknown }): boolean {
  return t.source === "cdi" || !!t.audio;
}

/** Listed tests that play a real recording (shown to the admin as a read-only note). */
export function realAudioTestCount(): number {
  return CDI_LISTENING.length;
}

/**
 * Every Listening test of the catalog that needs TTS, in catalog order — the
 * legacy short tests and the CDI tests (real recordings) excluded.
 */
export async function catalogTests(): Promise<ExamListeningTest[]> {
  const summaries = (await listListeningExams()).filter((s) => s.source !== "legacy" && !hasRealAudio(s));
  const byId = new Map<string, ExamListeningTest>();
  if (summaries.length) {
    try {
      const rows = (await db.generatedTest.findMany({
        where: { module: "LISTENING", published: true },
        select: { id: true, data: true },
      })) as { id: string; data: unknown }[];
      for (const r of rows) {
        const t = listeningFromRow(r);
        if (t) byId.set(t.id, t);
      }
    } catch {
      /* one by one below */
    }
  }
  const out: ExamListeningTest[] = [];
  for (const s of summaries) {
    const t = byId.get(s.id) ?? (await getListeningExam(s.id));
    if (t && t.source !== "legacy" && !hasRealAudio(t)) out.push(t);
  }
  return out;
}

/**
 * The placement forms' Listening tests, once each. The placement test plays
 * them through listeningClientContent like any other test, so a recording
 * rendered here replaces their script in the placement too.
 */
export function placementListeningTests(): ExamListeningTest[] {
  const byId = new Map<string, ExamListeningTest>();
  for (const f of PLACEMENT_FORMS) {
    const t = f?.listening;
    if (t && typeof t.id === "string" && t.parts?.length && !byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

/** The Listening test behind `testId`: a placement form's test, or the catalog's (getListeningExam). */
export async function resolveAudioTest(testId: string): Promise<ExamListeningTest | null> {
  return placementListeningTests().find((t) => t.id === testId) ?? (await getListeningExam(testId));
}

async function findRow(testId: string, partIndex: number): Promise<AudioRow | null> {
  try {
    return ((await db.listeningAudio.findUnique({
      where: { testId_partIndex: { testId, partIndex } },
      select: ROW_SELECT,
    })) ?? null) as AudioRow | null;
  } catch {
    return null;
  }
}

function dbErrorText(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "P2021" || /does not exist|relation .*listening_audio/i.test(shortError(e))) {
    return "listening_audio jadvali topilmadi — maʼlumotlar bazasiga prisma/sql/deploy.sql ni qoʻllang.";
  }
  return `Audio yozuvlarini oʻqib boʻlmadi: ${shortError(e)}`;
}

export async function audioOverview(): Promise<AudioOverview> {
  const model = TTS_MODEL();
  let dbError: string | null = null;
  const loadRows = async (): Promise<AudioRow[]> =>
    (await db.listeningAudio.findMany({ select: ROW_SELECT, orderBy: [{ testId: "asc" }, { partIndex: "asc" }] })) as AudioRow[];
  const [catalog, rows, speakingUsage] = await Promise.all([
    catalogTests(),
    loadRows().catch((e: unknown) => {
      dbError = dbErrorText(e);
      return [] as AudioRow[];
    }),
    // The same Blob store holds recorded Speaking answers: they count against the same 1 GB / 2,000 uploads.
    speakingStorageUsage().catch((e: unknown) => {
      console.error("Speaking storage usage unavailable:", e);
      return null;
    }),
  ]);
  // The placement test's Listening first (every new student sits it), then the library.
  const placement = placementListeningTests();
  const placementIds = new Set(placement.map((t) => t.id));
  const tests = [...placement, ...catalog.filter((t) => !placementIds.has(t.id))];

  const byTest = new Map<string, Map<number, AudioRow>>();
  for (const r of rows) {
    if (!byTest.has(r.testId)) byTest.set(r.testId, new Map());
    byTest.get(r.testId)!.set(r.partIndex, r);
  }

  const totals = { bytes: 0, files: 0, ready: 0, stale: 0, failed: 0, missing: 0, readyMs: 0, bytesPerSecond: null as number | null };
  let measuredBytes = 0;
  let measuredMs = 0;
  for (const r of rows) {
    if (!r.url) continue;
    totals.bytes += r.bytes || 0;
    totals.files += 1;
    if (r.bytes > 0 && r.durationMs > 0) {
      measuredBytes += r.bytes;
      measuredMs += r.durationMs;
    }
  }
  totals.bytesPerSecond = measuredMs > 0 ? Math.round((measuredBytes * 1000) / measuredMs) : null;

  const known = new Set<string>();
  const list: TestAudioInfo[] = tests.map((t) => {
    known.add(t.id);
    const rowsOf = byTest.get(t.id);
    const parts = t.parts.map((_p, i) => partInfo(t, i, rowsOf?.get(i), model));
    for (const p of parts) {
      if (p.status === "ready") {
        totals.ready += 1;
        totals.readyMs += p.durationMs;
      } else if (p.status === "stale") totals.stale += 1;
      else if (p.status === "failed") totals.failed += 1;
      else totals.missing += 1;
    }
    const questions = t.parts.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.questions.length, 0), 0);
    return {
      id: t.id,
      title: t.title,
      source: t.source,
      difficulty: t.difficulty,
      full: t.parts.length === 4 && questions === 40,
      placement: placementIds.has(t.id),
      parts,
    };
  });

  const orphans: OrphanAudioInfo[] = [];
  byTest.forEach((parts, testId) => {
    if (known.has(testId)) return;
    const list = Array.from(parts.values()).sort((a, b) => a.partIndex - b.partIndex);
    orphans.push({
      testId,
      parts: list.map((r) => ({ index: r.partIndex, status: r.status, bytes: r.url ? r.bytes : 0, durationMs: r.durationMs, url: r.url })),
      bytes: list.reduce((n, r) => n + (r.url ? r.bytes : 0), 0),
    });
  });

  return {
    blobConfigured: blobConfigured(),
    openAiConfigured: audioAiConfigured(),
    audioOff: !listeningAudioEnabled(),
    voiceModel: model,
    dbError,
    tests: list,
    realAudioTests: realAudioTestCount(),
    orphans,
    totals,
    speaking: speakingUsage ? { ...speakingUsage, monthlyLimit: monthlyAudioUploadLimit() } : null,
    generatedAt: new Date().toISOString(),
  };
}

/** Note a failed render. A recording that still exists is kept (and served while its hash matches). */
async function recordFailure(test: ExamListeningTest, partIndex: number, prev: AudioRow | null, error: unknown, model: string): Promise<void> {
  const text = shortError(error);
  try {
    if (prev && prev.status === "ready" && prev.url) {
      await db.listeningAudio.update({ where: { id: prev.id }, data: { error: text } });
      return;
    }
    const hash = partAudioHash(test, partIndex, model) ?? "";
    const data = { status: "failed", url: null, bytes: 0, durationMs: 0, scriptHash: hash, voiceModel: model, error: text };
    await db.listeningAudio.upsert({
      where: { testId_partIndex: { testId: test.id, partIndex } },
      create: { testId: test.id, partIndex, ...data },
      update: { ...data, timeline: Prisma.DbNull },
    });
    if (prev?.url) await deleteBlobs([prev.url]);
  } catch {
    /* the error still reaches the admin in the response */
  }
}

/** The part's status as stored right now (after a failed render, for the admin list). */
export async function currentPartInfo(test: ExamListeningTest, partIndex: number): Promise<PartAudioInfo> {
  return partInfo(test, partIndex, (await findRow(test.id, partIndex)) ?? undefined, TTS_MODEL());
}

export interface StoredRender {
  part: PartAudioInfo;
  rendered: RenderedPart;
}

/** Render one part, upload it and record it. Throws RenderError / StoreError. */
export async function renderAndStore(test: ExamListeningTest, partIndex: number, startedAt: number): Promise<StoredRender> {
  const model = TTS_MODEL();
  const prev = await findRow(test.id, partIndex);

  let rendered: RenderedPart;
  try {
    rendered = await renderListeningPart(test, partIndex, { startedAt });
  } catch (e) {
    // Rate limits and configuration problems aren't this part's fault — nothing to record.
    if (!(e instanceof RenderError) || (e.kind !== "rate_limit" && e.kind !== "config")) await recordFailure(test, partIndex, prev, e, model);
    throw e;
  }

  let url: string;
  try {
    url = (await putBlob(blobPath(test.id, partIndex), rendered.bytes, { contentType: "audio/mpeg" })).url;
  } catch (e) {
    const err = new StoreError("storage", `Blob upload failed: ${shortError(e)}`);
    await recordFailure(test, partIndex, prev, err, model);
    throw err;
  }

  const data = {
    status: "ready",
    url,
    bytes: rendered.bytes.length,
    durationMs: rendered.durationMs,
    scriptHash: rendered.scriptHash,
    voiceModel: rendered.voiceModel,
    timeline: rendered.timeline as unknown as Prisma.InputJsonValue,
    error: null,
  };
  let row: AudioRow;
  try {
    row = (await db.listeningAudio.upsert({
      where: { testId_partIndex: { testId: test.id, partIndex } },
      create: { testId: test.id, partIndex, ...data },
      update: data,
      select: ROW_SELECT,
    })) as AudioRow;
  } catch (e) {
    await deleteBlobs([url]); // don't leave an orphan file behind
    throw new StoreError("server", `Saving the recording failed: ${shortError(e)}`);
  }
  if (prev?.url && prev.url !== url) await deleteBlobs([prev.url]);
  return { part: partInfo(test, partIndex, row, model), rendered };
}

/** Delete a test's recordings (or one part's). Files first: a row is only removed once its file is gone. */
export async function deleteAudio(testId: string, partIndex: number | null): Promise<{ deleted: number; filesKept: number }> {
  const where = partIndex == null ? { testId } : { testId, partIndex };
  const rows = (await db.listeningAudio.findMany({ where, select: { id: true, url: true } })) as { id: string; url: string | null }[];
  const urls = rows.map((r) => r.url).filter((u): u is string => typeof u === "string" && u.length > 0);
  let filesKept = 0;
  if (urls.length) {
    if (blobConfigured()) {
      if (!(await deleteBlobs(urls))) throw new StoreError("storage", "Blob delete failed.");
    } else {
      filesKept = urls.length; // no token: the files can't be removed from here
    }
  }
  const res = (await db.listeningAudio.deleteMany({ where })) as { count?: number } | null;
  return { deleted: typeof res?.count === "number" ? res.count : rows.length, filesKept };
}
