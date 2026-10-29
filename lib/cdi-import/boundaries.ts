/**
 * Part boundary candidates of a whole recording, from pauses and answer
 * windows. Candidates are suggestions only: staff confirm every boundary by
 * ear in the Audio_Manager before a part can be practised on its own.
 */

import { MIN_PART_MS, MIN_SPLIT_DURATION_MS, segmentsFromBoundaries, validateSegments, type BoundaryCandidate, type Window } from "../ielts/segments";
import type { Pause } from "./silence";

export type { BoundaryCandidate } from "../ielts/segments";

export const LONG_PAUSE_MS = 10_000;
/** A candidate sits this long before the end of its pause (just before "Now turn to Part 2"). */
export const BEFORE_SPEECH_MS = 500;

export interface BoundaryContext {
  durationMs: number;
  /** Answer windows per part (null or empty lists when the source has none). */
  windowsByPart: Window[][] | null;
}

function hasWindows(ctx: BoundaryContext, part: number): boolean {
  return !!ctx.windowsByPart && (ctx.windowsByPart[part]?.length ?? 0) > 0;
}

/** Where boundary k (between parts k and k+1) may lie; null when the interval is empty. */
export function admissibleInterval(k: 1 | 2 | 3, ctx: BoundaryContext): { from: number; to: number } | null {
  const D = ctx.durationMs;
  let from: number;
  let to: number;
  if (hasWindows(ctx, k - 1) && hasWindows(ctx, k)) {
    from = Math.max(...ctx.windowsByPart![k - 1].map((w) => w.endMs));
    to = Math.min(...ctx.windowsByPart![k].map((w) => w.startMs));
  } else {
    from = (k * D) / 4 - D / 8;
    to = (k * D) / 4 + D / 8;
  }
  // Every part stays at least two minutes long.
  from = Math.max(from, k * MIN_PART_MS);
  to = Math.min(to, D - (4 - k) * MIN_PART_MS);
  from = Math.ceil(from);
  to = Math.floor(to);
  return to > from ? { from, to } : null;
}

export function proposeBoundaries(ctx: BoundaryContext & { pauses: Pause[] }): { candidates: (BoundaryCandidate | null)[]; warnings: string[] } {
  const warnings: string[] = [];
  if (ctx.durationMs < MIN_SPLIT_DURATION_MS) {
    return { candidates: [null, null, null], warnings: [`The recording is shorter than 8 minutes: no part boundaries are proposed.`] };
  }
  const candidates = ([1, 2, 3] as const).map((k): BoundaryCandidate | null => {
    const iv = admissibleInterval(k, ctx);
    if (!iv) {
      warnings.push(`Boundary ${k}: no admissible interval between Part ${k} and Part ${k + 1}.`);
      return null;
    }
    const inside = ctx.pauses
      .map((p) => ({ startMs: Math.max(p.startMs, iv.from), endMs: Math.min(p.endMs, iv.to) }))
      .filter((p) => p.endMs - p.startMs >= 1000);
    const long = inside.find((p) => p.endMs - p.startMs >= LONG_PAUSE_MS);
    const pick = long ?? inside.slice().sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs) || a.startMs - b.startMs)[0];
    if (pick) return { boundary: k, ms: Math.round(Math.max(pick.startMs, pick.endMs - BEFORE_SPEECH_MS)), method: "pause" };
    if (hasWindows(ctx, k - 1) && hasWindows(ctx, k)) return { boundary: k, ms: Math.round((iv.from + iv.to) / 2), method: "evidence" };
    warnings.push(`Boundary ${k}: no pause of at least 1 s between Part ${k} and Part ${k + 1}; it stays empty.`);
    return null;
  });
  if (candidates.every((c) => c)) {
    const segs = segmentsFromBoundaries([candidates[0]!.ms, candidates[1]!.ms, candidates[2]!.ms], ctx.durationMs);
    const v = validateSegments(segs, { durationMs: ctx.durationMs, windowsByPart: ctx.windowsByPart ?? [[], [], [], []] });
    if (v) {
      warnings.push(`The proposed boundaries break the ${v.rule} rule (Part ${v.part}); all three were dropped.`);
      return { candidates: [null, null, null], warnings };
    }
  }
  return { candidates, warnings };
}
