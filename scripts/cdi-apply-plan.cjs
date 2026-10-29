/**
 * Pure decisions of the CDI manifest import (scripts/import-cdi-manifest.cjs)
 * and of publishing (scripts/cdi-v10/publish.cjs). No database access here:
 * the callers read the rows, ask these functions, then write.
 */

/** Columns listening_part_segments must have before anything is written (20.6). */
const REQUIRED_SCHEMA = ["testId", "recordingSha256", "durationMs", "candidates", "segments", "verifiedById", "verifiedAt", "revision", "createdAt", "updatedAt"];

function missingColumns(columns) {
  const have = new Set((columns || []).map((c) => String(c)));
  return REQUIRED_SCHEMA.filter((c) => !have.has(c));
}

function provider(row) {
  return row && row.data && typeof row.data === "object" && row.data.imported ? row.data.imported.provider : undefined;
}

/**
 * All-or-nothing check of every manifest id against the existing rows (16.4):
 * an existing row is only replaced when it is unpublished, created by this
 * importer, of the same module and from the same source file.
 * @returns {{ ok: true, steps: { id: string, action: "create" | "update" }[] } | { ok: false, conflicts: { id: string, reason: string }[] }}
 */
function planApply(items, existingRows) {
  const byId = new Map((existingRows || []).map((r) => [r.id, r]));
  const conflicts = [];
  const steps = [];
  for (const item of items) {
    const row = byId.get(item.id);
    if (!row) {
      steps.push({ id: item.id, action: "create" });
      continue;
    }
    if (row.published) conflicts.push({ id: item.id, reason: "a published paper already uses this id" });
    else if (provider(row) !== "user-supplied-cdi") conflicts.push({ id: item.id, reason: "the existing paper was not created by the CDI importer" });
    else if (row.module !== item.module) conflicts.push({ id: item.id, reason: "the existing paper belongs to another module" });
    else if (!row.data.imported || row.data.imported.file !== (item.source && item.source.file)) conflicts.push({ id: item.id, reason: "the existing paper comes from another source file" });
    else steps.push({ id: item.id, action: "update" });
  }
  return conflicts.length ? { ok: false, conflicts } : { ok: true, steps };
}

/**
 * The listening_part_segments row after (re-)applying a manifest item (16.8, 16.9):
 * same recording → only the candidates change; another recording → the
 * boundaries and their verification are cleared and the revision moves on.
 */
function nextSegmentsRow(existing, item) {
  const candidates = { v: 1, boundaries: Array.isArray(item.boundaryCandidates) ? item.boundaryCandidates : [null, null, null] };
  const sha = item.audio.sha256;
  const durationMs = item.audio.durationMs;
  if (!existing) {
    return { candidates, segments: null, verifiedAt: null, verifiedById: null, revision: 0, recordingSha256: sha, durationMs };
  }
  if (existing.recordingSha256 === sha && existing.durationMs === durationMs) {
    return {
      candidates,
      segments: existing.segments ?? null,
      verifiedAt: existing.verifiedAt ?? null,
      verifiedById: existing.verifiedById ?? null,
      revision: existing.revision,
      recordingSha256: sha,
      durationMs,
    };
  }
  return {
    candidates,
    segments: null,
    verifiedAt: null,
    verifiedById: null,
    revision: (existing.revision || 0) + 1,
    recordingSha256: sha,
    durationMs,
    warning: `${item.id}: the recording changed (SHA-256 or duration); its part boundaries must be confirmed again.`,
  };
}

/** The whole-recording row of a Listening item (one row, partIndex -1). */
function audioRow(item) {
  const a = item.audio;
  return { status: "ready", url: a.url, bytes: a.bytes, durationMs: a.durationMs, scriptHash: a.scriptHash, voiceModel: "supplied-whole-v1", timeline: [] };
}

/**
 * Publish / unpublish (17.4, 17.5): only listed CDI imports of Reading or Listening;
 * publishing Listening also needs its ready HTTPS whole recording.
 * @returns {{ ok: string[], refused: { id: string, reason: string }[] }}
 */
function planPublish(ids, rows, audioRows, publish) {
  const byId = new Map((rows || []).map((r) => [r.id, r]));
  const ok = [];
  const refused = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) refused.push({ id, reason: "no such paper" });
    else if (row.module !== "READING" && row.module !== "LISTENING") refused.push({ id, reason: "not a Reading or Listening paper" });
    else if (provider(row) !== "user-supplied-cdi") refused.push({ id, reason: "not a CDI import" });
    else if (publish && row.module === "LISTENING") {
      const a = (audioRows || []).find((x) => x.testId === id && x.partIndex === -1);
      if (!a || a.status !== "ready" || typeof a.url !== "string" || !a.url.startsWith("https://") || !(a.durationMs > 0)) refused.push({ id, reason: "its whole recording is not ready" });
      else ok.push(id);
    } else ok.push(id);
  }
  return { ok, refused };
}

module.exports = { REQUIRED_SCHEMA, missingColumns, planApply, nextSegmentsRow, audioRow, planPublish };
