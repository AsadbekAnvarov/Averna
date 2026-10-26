/**
 * The grade queue on this device (localStorage, OFFLINE_QUEUE_KEY). Browser only.
 * Logic: lib/offline/sync-queue.ts. Sending: lib/offline/sync.ts.
 */
import { OFFLINE_EVENT, OFFLINE_QUEUE_KEY } from "./constants";
import { enqueue, pendingFor, type QueueIO, type QueuedGrade } from "./sync-queue";
import type { Rating } from "@/lib/srs";

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

function isGrade(v: unknown): v is QueuedGrade {
  const g = v as Partial<QueuedGrade> | null;
  return (
    !!g &&
    typeof g.id === "string" &&
    typeof g.ownerId === "string" &&
    typeof g.itemKey === "string" &&
    RATINGS.includes(g.rating as Rating) &&
    (g.source === "vocab" || g.source === "mistake") &&
    typeof g.reviewedAt === "number" &&
    typeof g.attempts === "number"
  );
}

export function loadQueue(): QueuedGrade[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isGrade) : [];
  } catch {
    return [];
  }
}

export function notifyOffline(): void {
  try {
    window.dispatchEvent(new Event(OFFLINE_EVENT));
  } catch {
    /* no window */
  }
}

export function saveQueue(queue: QueuedGrade[]): void {
  try {
    if (queue.length) localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    else localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    /* storage full or blocked: the grade still counted on this device */
  }
  notifyOffline();
}

export const storageQueue: QueueIO = { read: loadQueue, write: saveQueue };

/** A client id for a grade: a UUID where available, else 32 random hex characters. */
export function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 32).padEnd(16, "0");
}

/** Queues one grade made now on this device; returns it. */
export function queueGrade(input: { ownerId: string; itemKey: string; rating: Rating; source?: "vocab" | "mistake"; reviewedAt?: number }): QueuedGrade {
  const grade: QueuedGrade = {
    id: newClientId(),
    ownerId: input.ownerId,
    itemKey: input.itemKey,
    rating: input.rating,
    source: input.source ?? "vocab",
    reviewedAt: input.reviewedAt ?? Date.now(),
    attempts: 0,
  };
  saveQueue(enqueue(loadQueue(), grade));
  return grade;
}

/** Grades of this user still waiting. */
export function pendingCount(ownerId: string | null | undefined): number {
  return ownerId ? pendingFor(loadQueue(), ownerId).length : 0;
}

export function clearQueue(): void {
  saveQueue([]);
}
