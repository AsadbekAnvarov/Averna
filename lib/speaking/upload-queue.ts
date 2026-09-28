/**
 * Background upload queue for recorded Speaking answers: one upload at a time,
 * retries with back-off, and the test flows on meanwhile. The runner waits
 * for the queue (`whenIdle`) before the final submission — or stops waiting
 * (`cancelPending`) and has the rest typed. An upload that runs out of
 * retries is reported (`onGiveUp`); OUTAGE_AFTER_EXHAUSTED of those
 * (countsTowardOutage) stop recording for the rest of the test.
 *
 * Client-safe and framework-free — the caller supplies `send` (the actual
 * request), so the queue is unit-tested offline with a fake transport.
 */

export type UploadAttempt<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      /** Worth trying again (network, 5xx, 429 …); false = this file will never be accepted. */
      retryable: boolean;
      message: string;
      code?: string;
      /** The server asked to wait this long (429 Retry-After). */
      retryAfterMs?: number;
    };

export interface UploadJob {
  /** Question index — a newer take of the same question replaces an older one. */
  index: number;
  blob: Blob;
  filename: string;
}

export interface UploadFailure {
  message: string;
  code?: string;
  /** It gave up after every retry on errors worth retrying (5xx, timeouts, the network …) — not refused outright. */
  exhausted?: boolean;
}

export interface UploadSnapshot<T> {
  /** Questions with a take in the queue (one per question). */
  total: number;
  done: number;
  failed: number;
  /** Queued, uploading or waiting to retry. */
  pending: number;
  /** Question being uploaded right now. */
  current: number | null;
  /** At least one upload is waiting to retry (connection problems). */
  retrying: boolean;
  results: ReadonlyMap<number, T>;
  failures: ReadonlyMap<number, UploadFailure>;
}

export interface UploadQueueOptions<T> {
  send: (job: UploadJob, signal: AbortSignal) => Promise<UploadAttempt<T>>;
  onChange?: (snapshot: UploadSnapshot<T>) => void;
  onResult?: (index: number, value: T) => void;
  /** An upload ran out of retries (its failure has `exhausted: true`) — see countsTowardOutage. */
  onGiveUp?: (index: number, failure: UploadFailure) => void;
  /** Wait before retry n (ms); its length is the number of retries per upload. */
  retryDelays?: number[];
  /** Longest wait a server's Retry-After may impose (ms). */
  maxRetryAfterMs?: number;
  /** Clock and timer — injectable for tests. */
  now?: () => number;
  sleep?: (ms: number, wake: AbortSignal) => Promise<void>;
}

/** ≈ 1 minute of retries in total before an upload is reported as failed. */
export const DEFAULT_RETRY_DELAYS = [1500, 4000, 8000, 15_000, 30_000];

/**
 * This many answers running out of retries on ordinary errors means the
 * server can't take recordings right now (a plain transcription outage: 5xx,
 * hanging requests): the runner stops recording for the rest of the test, as
 * for "unavailable".
 */
export const OUTAGE_AFTER_EXHAUSTED = 2;

/**
 * A given-up upload that points at an outage: it ran out of retries (not
 * refused outright), wasn't just rate-limited, and the browser is online (an
 * offline spell is retried when the connection is back instead).
 */
export function countsTowardOutage(failure: UploadFailure, online: boolean): boolean {
  return failure.exhausted === true && failure.code !== "rate-limited" && online;
}

type State = "queued" | "uploading" | "waiting" | "done" | "failed";

interface Entry {
  index: number;
  filename: string;
  /** Dropped once uploaded. */
  blob: Blob | null;
  state: State;
  attempts: number;
  /** FIFO order. */
  seq: number;
  retryAt: number;
  failure?: UploadFailure;
}

function defaultSleep(ms: number, wake: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (wake.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      wake.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    wake.addEventListener("abort", done, { once: true });
  });
}

export class UploadQueue<T> {
  private readonly entries = new Map<number, Entry>();
  private readonly results = new Map<number, T>();
  private seq = 0;
  private running = false;
  private disposed = false;
  private readonly stopper = new AbortController();
  private wake: AbortController | null = null;
  /** The request in flight (cancelPending aborts it). */
  private inflight: AbortController | null = null;
  private idleWaiters: ((s: UploadSnapshot<T>) => void)[] = [];

  constructor(private readonly opts: UploadQueueOptions<T>) {}

  /** Queue one answer's recording (replaces any earlier take of the same question). */
  enqueue(job: UploadJob): void {
    if (this.disposed) return;
    this.results.delete(job.index);
    this.entries.set(job.index, {
      index: job.index,
      filename: job.filename,
      blob: job.blob,
      state: "queued",
      attempts: 0,
      seq: ++this.seq,
      retryAt: 0,
    });
    this.changed();
    this.interrupt();
    void this.pump();
  }

  /** Try failed uploads again with a fresh retry budget — all of them, or those `which` picks. */
  retryFailed(which?: (failure: UploadFailure) => boolean): void {
    if (this.disposed) return;
    let any = false;
    for (const e of this.entries.values()) {
      if (e.state !== "failed" || !e.blob) continue;
      if (which && !which(e.failure ?? { message: "" })) continue;
      e.state = "queued";
      e.attempts = 0;
      e.failure = undefined;
      e.seq = ++this.seq;
      any = true;
    }
    if (!any) return;
    this.changed();
    this.interrupt();
    void this.pump();
  }

  /** Retry uploads that are waiting for their back-off right away (e.g. the browser is back online). */
  nudge(): void {
    for (const e of this.entries.values()) if (e.state === "waiting") e.retryAt = 0;
    this.interrupt();
  }

  /**
   * Stop waiting: every upload that is queued, in flight or waiting to retry
   * fails now with `failure` (the request in flight is aborted). Their
   * recordings are kept, so retryFailed can send them again; whenIdle
   * resolves. Returns how many were stopped.
   */
  cancelPending(failure: UploadFailure): number {
    if (this.disposed) return 0;
    let n = 0;
    for (const e of this.entries.values()) {
      if (e.state !== "queued" && e.state !== "uploading" && e.state !== "waiting") continue;
      e.state = "failed";
      e.failure = { ...failure };
      n++;
    }
    if (!n) return 0;
    this.inflight?.abort();
    this.interrupt();
    this.changed();
    if (!this.busy()) this.flushIdle();
    return n;
  }

  /** Resolves when nothing is queued, uploading or waiting (every take is done or failed). */
  whenIdle(): Promise<UploadSnapshot<T>> {
    if (this.disposed || !this.busy()) return Promise.resolve(this.snapshot());
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  snapshot(): UploadSnapshot<T> {
    let done = 0;
    let failed = 0;
    let pending = 0;
    let current: number | null = null;
    let retrying = false;
    const failures = new Map<number, UploadFailure>();
    for (const e of this.entries.values()) {
      if (e.state === "done") done++;
      else if (e.state === "failed") {
        failed++;
        failures.set(e.index, e.failure ?? { message: "Upload failed." });
      } else {
        pending++;
        if (e.state === "uploading") current = e.index;
        if (e.state === "waiting") retrying = true;
      }
    }
    return { total: this.entries.size, done, failed, pending, current, retrying, results: new Map(this.results), failures };
  }

  /** Stop: abort the upload in flight and drop every pending one. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopper.abort();
    this.interrupt();
    this.flushIdle();
  }

  // -- internals ----------------------------------------------------------------

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  private busy(): boolean {
    for (const e of this.entries.values()) if (e.state === "queued" || e.state === "uploading" || e.state === "waiting") return true;
    return false;
  }

  private changed(): void {
    try {
      this.opts.onChange?.(this.snapshot());
    } catch {
      /* a listener bug must not stop the uploads */
    }
  }

  private interrupt(): void {
    this.wake?.abort();
  }

  private flushIdle(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    if (!waiters.length) return;
    const s = this.snapshot();
    waiters.forEach((w) => w(s));
  }

  /** The next upload to run: queued, or waiting and due — oldest first. */
  private next(now: number): Entry | null {
    let best: Entry | null = null;
    for (const e of this.entries.values()) {
      const ready = e.state === "queued" || (e.state === "waiting" && e.retryAt <= now);
      if (ready && e.blob && (!best || e.seq < best.seq)) best = e;
    }
    return best;
  }

  private async sleepUntil(t: number): Promise<void> {
    const wake = new AbortController();
    this.wake = wake;
    const onStop = () => wake.abort();
    this.stopper.signal.addEventListener("abort", onStop);
    try {
      await (this.opts.sleep ?? defaultSleep)(Math.max(0, t - this.now()), wake.signal);
    } finally {
      this.stopper.signal.removeEventListener("abort", onStop);
      if (this.wake === wake) this.wake = null;
    }
  }

  private async pump(): Promise<void> {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (!this.disposed) {
        const entry = this.next(this.now());
        if (!entry) {
          let soonest = Infinity;
          for (const e of this.entries.values()) if (e.state === "waiting") soonest = Math.min(soonest, e.retryAt);
          if (soonest === Infinity) break;
          await this.sleepUntil(soonest);
          continue;
        }
        entry.state = "uploading";
        this.changed();
        // One controller per request: dispose() (stopper) and cancelPending() both abort it.
        const ctrl = new AbortController();
        const onStop = () => ctrl.abort();
        this.stopper.signal.addEventListener("abort", onStop);
        this.inflight = ctrl;
        let r: UploadAttempt<T>;
        try {
          r = await this.opts.send({ index: entry.index, filename: entry.filename, blob: entry.blob as Blob }, ctrl.signal);
        } catch (e) {
          r = { ok: false, retryable: true, message: e instanceof Error && e.message ? e.message : "Network error." };
        } finally {
          this.stopper.signal.removeEventListener("abort", onStop);
          if (this.inflight === ctrl) this.inflight = null;
        }
        if (this.disposed) break;
        if (this.entries.get(entry.index) !== entry) continue; // a newer take replaced it meanwhile
        if (entry.state !== "uploading") continue; // stopped meanwhile (cancelPending), or already sent again
        if (r.ok) {
          entry.state = "done";
          entry.failure = undefined;
          entry.blob = null;
          this.results.set(entry.index, r.value);
          try {
            this.opts.onResult?.(entry.index, r.value);
          } catch {
            /* ignore listener bugs */
          }
          this.changed();
          continue;
        }
        entry.attempts++;
        entry.failure = { message: r.message, code: r.code };
        const delays = this.opts.retryDelays ?? DEFAULT_RETRY_DELAYS;
        let gaveUp = false;
        if (r.retryable && entry.attempts <= delays.length) {
          const asked = Math.min(Math.max(0, r.retryAfterMs ?? 0), this.opts.maxRetryAfterMs ?? 60_000);
          entry.state = "waiting";
          entry.retryAt = this.now() + Math.max(delays[entry.attempts - 1], asked);
        } else {
          entry.state = "failed";
          // Worth retrying, but the retries are used up (an outage rather than this file).
          if (r.retryable) entry.failure.exhausted = gaveUp = true;
        }
        this.changed();
        if (gaveUp) {
          try {
            this.opts.onGiveUp?.(entry.index, { ...entry.failure });
          } catch {
            /* ignore listener bugs */
          }
        }
      }
    } finally {
      this.running = false;
      if (this.disposed || !this.busy()) this.flushIdle();
    }
  }
}
