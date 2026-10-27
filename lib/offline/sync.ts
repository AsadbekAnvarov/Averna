/**
 * Sends queued flashcard grades to POST /api/srs/review (idea 7). Browser only.
 *
 * Conflict rule (server wins): when the server answers that a grade is stale (the card was
 * reviewed online after the grade was made) or a duplicate, the device adopts the server's
 * state for that card. Requests the server can never accept (400 / 403 / 404, e.g. a viewer
 * without a student profile) drop their grades; network and server errors keep them.
 */
import { loadSrs, saveSrs, type SrsCardState } from "@/lib/srs";
import { notifyOffline, pendingCount, storageQueue } from "./queue-store";
import { drainQueue, requestBody, type QueuedGrade } from "./sync-queue";

export type SyncFailure = "offline" | "server" | null;

export interface SyncOutcome {
  synced: number;
  /** This user's grades still waiting after the run. */
  pending: number;
  failure: SyncFailure;
}

class SyncError extends Error {
  constructor(readonly kind: Exclude<SyncFailure, null>) {
    super(kind);
  }
}

type ServerResult = { itemKey?: unknown; clientId?: unknown; status?: unknown; state?: unknown };

function isState(v: unknown): v is SrsCardState {
  const s = v as Partial<SrsCardState> | null;
  return !!s && [s.ease, s.interval, s.due, s.reps, s.lapses].every((n) => typeof n === "number" && Number.isFinite(n));
}

async function send(batch: QueuedGrade[]): Promise<string[]> {
  const all = batch.map((g) => g.id);
  let res: Response;
  try {
    res = await fetch("/api/srs/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(batch)),
    });
  } catch {
    throw new SyncError("offline");
  }
  if (res.status === 400 || res.status === 403 || res.status === 404) return all;
  if (!res.ok) throw new SyncError("server");
  const data = (await res.json().catch(() => null)) as { results?: ServerResult[] } | null;
  // Server wins for stale grades (and duplicates): keep its state for those cards.
  const adopted: Record<string, SrsCardState> = {};
  for (const r of Array.isArray(data?.results) ? data.results : []) {
    if ((r.status === "stale" || r.status === "duplicate") && typeof r.itemKey === "string" && isState(r.state)) adopted[r.itemKey] = r.state;
  }
  if (Object.keys(adopted).length) saveSrs({ ...loadSrs(), ...adopted });
  // The request was processed: every grade in it is settled (one the server refused as malformed can never succeed).
  return all;
}

/**
 * Grades are only ever sent for the user who made them: the request's cookie must belong to
 * that user (a shared device may have another account signed in by now).
 */
let verified: { id: string; at: number } | null = null;
const VERIFIED_FOR_MS = 60_000;

async function signedInAs(ownerId: string): Promise<boolean> {
  if (verified && verified.id === ownerId && Date.now() - verified.at < VERIFIED_FOR_MS) return true;
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { user?: { id?: unknown } } | null;
    const ok = data?.user?.id === ownerId;
    verified = ok ? { id: ownerId, at: Date.now() } : null;
    return ok;
  } catch {
    return false;
  }
}

/** Forget the cached check (sign-out). */
export function forgetSignedInUser(): void {
  verified = null;
}

let inflight: Promise<SyncOutcome> | null = null;
let rerun = false;
let lastFailure: SyncFailure = null;

/** How the last run ended: "offline" when the server couldn't be reached (even with the device "online"). */
export function lastSyncFailure(): SyncFailure {
  return lastFailure;
}

/** Sends this user's waiting grades; one run at a time (a call during a run schedules one more). */
export function syncReviews(ownerId: string | null | undefined): Promise<SyncOutcome> {
  if (!ownerId) return Promise.resolve({ synced: 0, pending: 0, failure: null });
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.resolve({ synced: 0, pending: pendingCount(ownerId), failure: "offline" });
  }
  if (inflight) {
    rerun = true;
    return inflight;
  }
  inflight = (async () => {
    let synced = 0;
    let failure: SyncFailure = null;
    if (pendingCount(ownerId) === 0) return { synced, pending: 0, failure };
    if (!(await signedInAs(ownerId))) return { synced, pending: pendingCount(ownerId), failure: "offline" as SyncFailure };
    do {
      rerun = false;
      const result = await drainQueue(storageQueue, ownerId, send);
      synced += result.synced;
      if (result.failed) {
        failure = result.error instanceof SyncError ? result.error.kind : "server";
        break;
      }
    } while (rerun);
    return { synced, pending: pendingCount(ownerId), failure };
  })()
    .then((outcome) => {
      lastFailure = outcome.pending > 0 ? outcome.failure : null;
      notifyOffline();
      return outcome;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
