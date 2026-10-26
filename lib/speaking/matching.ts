/**
 * Smart peer matching (docs/peer-speaking.md §3). Pure — the match route feeds it
 * queue rows, recent partners and blocks, then claims the chosen partner atomically.
 */

export const PEER_FORMATS = ["exam", "quick", "conversation", "debate"] as const;
export type PeerFormat = (typeof PEER_FORMATS)[number];

export function isPeerFormat(v: unknown): v is PeerFormat {
  return typeof v === "string" && (PEER_FORMATS as readonly string[]).includes(v);
}

/** A queue entry counts as present while its heartbeat is at most this old. */
export const FRESH_MS = 15_000;
/** Entries silent for longer than this are deleted on the next match call. */
export const STALE_MS = 60_000;
/** After this long without a partner the UI offers alternatives. */
export const SUGGEST_ALTERNATIVES_MS = 60_000;
/** How many of a student's latest sessions count as "recent partners". */
export const RECENT_PARTNER_SESSIONS = 3;

export const BASE_GAP = 0.5;
export const GAP_STEP = 0.5;
export const GAP_STEP_MS = 20_000;
/** Score bonus (in bands) for the partner's wait, reached at WAIT_BONUS_CAP_MS. */
export const WAIT_BONUS = 0.25;
export const WAIT_BONUS_CAP_MS = 120_000;
/** Score bonus (in bands) for a partner from a different group — meet new people. */
export const NEW_GROUP_BONUS = 0.25;

export interface WaitingEntry {
  id: string;
  studentId: string;
  groupId: string | null;
  /** Band estimate 3.0–9.0. */
  level: number;
  format: PeerFormat;
  joinedAt: number;
  lastSeenAt: number;
}

export interface MatchContext {
  /** studentId → partner studentIds of their latest sessions (newest first). */
  recentPartners: Record<string, readonly string[]>;
  blocks: readonly { blockerId: string; blockedId: string }[];
}

export const isFresh = (e: Pick<WaitingEntry, "lastSeenAt">, now: number) => now - e.lastSeenAt <= FRESH_MS;

/** Allowed level gap for a pair: widens by GAP_STEP for every GAP_STEP_MS the OLDER of the two has waited. */
export function allowedGap(a: Pick<WaitingEntry, "joinedAt">, b: Pick<WaitingEntry, "joinedAt">, now: number): number {
  const waited = Math.max(0, now - Math.min(a.joinedAt, b.joinedAt));
  return BASE_GAP + GAP_STEP * Math.floor(waited / GAP_STEP_MS);
}

export function isBlocked(ctx: MatchContext, x: string, y: string): boolean {
  return ctx.blocks.some((b) => (b.blockerId === x && b.blockedId === y) || (b.blockerId === y && b.blockedId === x));
}

export function isRecentPartner(ctx: MatchContext, x: string, y: string): boolean {
  return (ctx.recentPartners[x] ?? []).includes(y) || (ctx.recentPartners[y] ?? []).includes(x);
}

/** Lower is better: the level gap, minus a small bonus for the partner's wait and for a different group. */
export function matchScore(me: WaitingEntry, c: WaitingEntry, now: number): number {
  const gap = Math.abs(me.level - c.level);
  const wait = Math.min(WAIT_BONUS_CAP_MS, Math.max(0, now - c.joinedAt));
  const waitBonus = (WAIT_BONUS * wait) / WAIT_BONUS_CAP_MS;
  const groupBonus = me.groupId !== c.groupId ? NEW_GROUP_BONUS : 0;
  return gap - waitBonus - groupBonus;
}

/**
 * The best partner for `me` among `candidates`, or null. Only fresh entries of the same
 * format, never self or a blocked pair, within the allowed level gap; recent partners
 * only when no one else qualifies. Ties: earlier joinedAt, then id.
 */
export function pickPartner(me: WaitingEntry, candidates: readonly WaitingEntry[], ctx: MatchContext, now: number): WaitingEntry | null {
  const eligible = candidates.filter(
    (c) =>
      c.studentId !== me.studentId &&
      c.id !== me.id &&
      c.format === me.format &&
      isFresh(c, now) &&
      !isBlocked(ctx, me.studentId, c.studentId) &&
      Math.abs(me.level - c.level) <= allowedGap(me, c, now) + 1e-9,
  );
  if (!eligible.length) return null;
  const fresh = eligible.filter((c) => !isRecentPartner(ctx, me.studentId, c.studentId));
  const pool = fresh.length ? fresh : eligible;
  let best: WaitingEntry | null = null;
  let bestScore = Infinity;
  for (const c of pool) {
    const s = matchScore(me, c, now);
    if (
      best === null ||
      s < bestScore - 1e-9 ||
      (Math.abs(s - bestScore) <= 1e-9 && (c.joinedAt < best.joinedAt || (c.joinedAt === best.joinedAt && c.id < best.id)))
    ) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/** Partner ids of a student's latest sessions, newest first (rooms must be sorted newest first). */
export function recentPartnersOf(
  studentId: string,
  rooms: readonly { studentAId: string; studentBId: string }[],
  limit = RECENT_PARTNER_SESSIONS,
): string[] {
  const out: string[] = [];
  for (const r of rooms) {
    if (out.length >= limit) break;
    if (r.studentAId === studentId) out.push(r.studentBId);
    else if (r.studentBId === studentId) out.push(r.studentAId);
  }
  return out;
}
