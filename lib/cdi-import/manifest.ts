/**
 * The deterministic manifest (version 1, the format scripts/import-cdi-manifest.cjs
 * reads): items sorted by id, keys written in a fixed order, integers only, no
 * dates and no local paths. Media URLs stay "cdi-asset://<path>" until
 * `verify` has checked the uploaded files.
 */

import { createHash } from "crypto";
import { wholeRecordingHash } from "../ielts/audio/hash";
import type { ExamListeningTest, ExamTest } from "../ielts/types";
import type { BoundaryCandidate } from "./boundaries";
import { ASSET_PREFIX, type SourceResult } from "./pipeline";

export interface ManifestMedia {
  path: string;
  sha256: string;
  bytes: number;
  verified: boolean;
}

export interface ManifestItem {
  id: string;
  module: "READING" | "LISTENING";
  title: string;
  data: ExamTest;
  validated: true;
  contentSha256: string;
  source: { file: string; sha256: string };
  audio?: { partIndex: -1; url: string; bytes: number; durationMs: number; sha256: string; scriptHash: string };
  media: ManifestMedia[];
  boundaryCandidates?: (BoundaryCandidate | null)[];
}

export interface Manifest {
  version: 1;
  batch: "volume-10";
  items: ManifestItem[];
}

export function contentSha256(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function item(r: SourceResult): ManifestItem {
  const data = r.paper!;
  const audio = r.audio
    ? {
        partIndex: -1 as const,
        url: `${ASSET_PREFIX}${r.audio.path}`,
        bytes: r.audio.bytes,
        durationMs: r.audio.durationMs,
        sha256: r.audio.sha256,
        scriptHash: wholeRecordingHash(data as ExamListeningTest),
      }
    : undefined;
  return {
    id: data.id,
    module: data.skill,
    title: data.title,
    data,
    validated: true,
    contentSha256: contentSha256(data),
    source: { file: r.file, sha256: r.meta!.sha256 },
    ...(audio ? { audio } : {}),
    media: r.media.map((m) => ({ path: m.path, sha256: m.sha256, bytes: m.bytes.length, verified: false })),
    ...(r.candidates ? { boundaryCandidates: r.candidates } : {}),
  };
}

export function buildManifest(results: SourceResult[]): Manifest {
  const items = results
    .filter((r) => r.included && r.paper && r.meta)
    .map(item)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: 1, batch: "volume-10", items };
}

/** Byte-stable text of a manifest (two-space JSON, trailing newline). */
export function manifestText(m: Manifest): string {
  return `${JSON.stringify(m, null, 2)}\n`;
}

/**
 * After `verify`: every "cdi-asset://<path>" becomes `<base><path>`, and the
 * fingerprints that depend on the data are computed again.
 */
export function resolveManifestAssets(m: Manifest, base: string): Manifest {
  const b = base.endsWith("/") ? base : `${base}/`;
  const items = m.items.map((it) => {
    const data = JSON.parse(JSON.stringify(it.data).split(ASSET_PREFIX).join(b)) as ExamTest;
    const audio = it.audio
      ? { ...it.audio, url: it.audio.url.split(ASSET_PREFIX).join(b), scriptHash: wholeRecordingHash(data as ExamListeningTest) }
      : undefined;
    return { ...it, data, contentSha256: contentSha256(data), ...(audio ? { audio } : {}), media: it.media.map((x) => ({ ...x, verified: true })) };
  });
  return { ...m, items };
}
