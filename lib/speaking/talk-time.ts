/**
 * Talk-time balance for peer rooms (docs/peer-speaking.md, Phase B). Pure and
 * client-side: the room feeds audio levels (RMS 0–1 of the WebAudio analyser) of the
 * student's own mic and of the partner's incoming stream; nothing is recorded or sent.
 *
 *   vadStep   — a tiny voice-activity detector: RMS over a threshold starts speech, and
 *               speech continues for `hangoverMs` after the last loud sample (so the short
 *               gaps between words still count). Time is credited per interval.
 *   addTalk / windowTotals — 5-second buckets for "the last 2 minutes".
 *   talkShare / dominantSide — "You 55% · Bek 45%" and the gentle nudge.
 */

export interface VadConfig {
  /** RMS (0–1) at or above which a sample counts as voice. */
  threshold: number;
  /** Speech continues this long after the last loud sample. */
  hangoverMs: number;
  /** Longest gap between two samples that is credited (background tabs throttle timers). */
  maxStepMs: number;
}

export const DEFAULT_VAD: VadConfig = { threshold: 0.025, hangoverMs: 400, maxStepMs: 1500 };

export interface VadState {
  speaking: boolean;
  lastVoiceAt: number | null;
  lastAt: number | null;
  /** Speaking milliseconds credited so far. */
  totalMs: number;
}

export const vadInit = (): VadState => ({ speaking: false, lastVoiceAt: null, lastAt: null, totalMs: 0 });

/**
 * One sample at time `at`. The interval since the previous sample is credited when the
 * detector was speaking at its start. Samples out of order are ignored.
 */
export function vadStep(s: VadState, rms: number, at: number, cfg: VadConfig = DEFAULT_VAD): VadState {
  if (s.lastAt !== null && at < s.lastAt) return s;
  const dt = s.lastAt === null ? 0 : Math.min(at - s.lastAt, cfg.maxStepMs);
  const totalMs = s.totalMs + (s.speaking ? dt : 0);
  const loud = Number.isFinite(rms) && rms >= cfg.threshold;
  const lastVoiceAt = loud ? at : s.lastVoiceAt;
  const speaking = loud || (s.speaking && lastVoiceAt !== null && at - lastVoiceAt <= cfg.hangoverMs);
  return { speaking, lastVoiceAt, lastAt: at, totalMs };
}

export interface TalkBucket {
  start: number;
  me: number;
  partner: number;
}

export const BUCKET_MS = 5000;
/** Buckets older than this are dropped (the nudge looks at the last 2 minutes). */
export const KEEP_MS = 5 * 60_000;

/** Credit `me` / `partner` speaking ms at time `at`. Returns a new array; old buckets are pruned. */
export function addTalk(buckets: readonly TalkBucket[], at: number, me: number, partner: number, bucketMs = BUCKET_MS): TalkBucket[] {
  const start = Math.floor(at / bucketMs) * bucketMs;
  const kept = buckets.filter((b) => b.start > at - KEEP_MS);
  const last = kept[kept.length - 1];
  if (last && last.start === start) {
    return [...kept.slice(0, -1), { start, me: last.me + Math.max(0, me), partner: last.partner + Math.max(0, partner) }];
  }
  return [...kept, { start, me: Math.max(0, me), partner: Math.max(0, partner) }];
}

/** Totals of the buckets that overlap the last `windowMs` before `now`. */
export function windowTotals(buckets: readonly TalkBucket[], now: number, windowMs: number): { me: number; partner: number } {
  let me = 0;
  let partner = 0;
  for (const b of buckets) {
    if (b.start + BUCKET_MS > now - windowMs && b.start <= now) {
      me += b.me;
      partner += b.partner;
    }
  }
  return { me, partner };
}

/** Below this much talk in total the share isn't shown (too little to mean anything). */
export const MIN_SHARE_MS = 5000;

/** Whole percentages that add up to 100, or null with too little talk. */
export function talkShare(me: number, partner: number, minMs = MIN_SHARE_MS): { me: number; partner: number } | null {
  const a = Math.max(0, me);
  const b = Math.max(0, partner);
  if (a + b < minMs || a + b <= 0) return null;
  const mine = Math.round((100 * a) / (a + b));
  return { me: mine, partner: 100 - mine };
}

export const NUDGE_WINDOW_MS = 2 * 60_000;
export const NUDGE_SHARE = 70;
/** The nudge needs at least this much talk in the window. */
export const NUDGE_MIN_MS = 45_000;

/** Which side spoke more than 70% of the talk in the window (with enough talk), else null. */
export function dominantSide(win: { me: number; partner: number }, share = NUDGE_SHARE, minMs = NUDGE_MIN_MS): "me" | "partner" | null {
  const total = Math.max(0, win.me) + Math.max(0, win.partner);
  if (total < minMs) return null;
  if ((100 * win.me) / total > share) return "me";
  if ((100 * win.partner) / total > share) return "partner";
  return null;
}

/** RMS (0–1) of 8-bit time-domain samples from AnalyserNode.getByteTimeDomainData. */
export function rmsOfBytes(data: ArrayLike<number>): number {
  if (!data.length) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}
