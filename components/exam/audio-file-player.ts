/**
 * Plays a pre-rendered Listening part (one MP3 on the Blob CDN) through ONE
 * HTMLAudioElement that the runner keeps for the whole test: mobile browsers
 * only let a page start audio from a tap, and an element that has played once
 * after a tap may later switch src and play on its own (next part, retry).
 *
 * One AudioFilePlayer per part (like ScriptPlayer): it attaches to the shared
 * element, loads the part's URL (preload auto), starts at `startMs`, and ends
 * at the file's end or at `endAtMs`. It reports loading / buffering, tells a
 * pause we asked for ("paused") from one the system made — a call, unplugged
 * headphones, another app ("stopped"), and turns load / network failures and
 * long stalls into errors; retry() reloads the element at the same position.
 *
 * No React; safe to import during SSR (nothing touches window at import time).
 */

export type FileState = "idle" | "loading" | "playing" | "buffering" | "paused" | "stopped" | "ended" | "error";

/** not-allowed = needs a tap; load = the file couldn't be fetched; stalled = no progress for a long time. */
export type FileErrorCode = "not-allowed" | "network" | "decode" | "load" | "stalled" | "unsupported";

export interface FileSnapshot {
  state: FileState;
  /** Playhead (ms into the file). */
  positionMs: number;
  durationMs: number;
  /** End of the buffered range around the playhead (ms). */
  bufferedMs: number;
  error: FileErrorCode | null;
}

export const FILE_IDLE: FileSnapshot = { state: "idle", positionMs: 0, durationMs: 0, bufferedMs: 0, error: null };

export interface AudioFilePlayerOptions {
  url: string;
  /** Length of the file (from the server — exact, unlike an early element.duration). */
  durationMs: number;
  startMs?: number;
  /** Stop here instead of at the end of the file. */
  endAtMs?: number;
  rate?: number;
  /** Exam conditions: lock-screen / headset controls can't pause or seek. */
  lockControls?: boolean;
  /** Shown on the lock screen / in the media notification. */
  title?: string;
  onChange?: (snapshot: FileSnapshot) => void;
  onEnd?: () => void;
  onError?: (code: FileErrorCode) => void;
}

/** No progress for this long while it should be playing → "stalled" (Retry continues from there). */
const STALL_MS = 20_000;
const OFFLINE_STALL_MS = 6_000;
/** onChange at most this often for position updates (state changes are immediate) — keeps the page's re-renders cheap. */
const EMIT_EVERY_MS = 500;
const MEDIA_ACTIONS = ["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"];

/** The one element a runner uses (null where there is no audio support at all). */
export function createAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof window.Audio !== "function") return null;
  try {
    const el = new window.Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    return el;
  } catch {
    return null;
  }
}

type MediaSessionLike = {
  metadata: unknown;
  setActionHandler: (action: string, handler: (() => void) | null) => void;
};

function mediaSession(): MediaSessionLike | null {
  if (typeof navigator === "undefined") return null;
  const ms = (navigator as unknown as { mediaSession?: MediaSessionLike }).mediaSession;
  return ms && typeof ms.setActionHandler === "function" ? ms : null;
}

/** Lock-screen controls: no-ops under exam conditions, the browser's defaults otherwise. */
export function setMediaSession(locked: boolean, title?: string): void {
  const ms = mediaSession();
  if (!ms) return;
  for (const action of MEDIA_ACTIONS) {
    try {
      ms.setActionHandler(action, locked && action !== "play" ? () => {} : null);
    } catch {
      /* action not supported here */
    }
  }
  try {
    const Meta = (window as unknown as { MediaMetadata?: new (init: { title: string; artist: string }) => unknown }).MediaMetadata;
    ms.metadata = title && Meta ? new Meta({ title, artist: "Averna · IELTS Listening" }) : null;
  } catch {
    /* ignore */
  }
}

export function releaseMediaSession(): void {
  setMediaSession(false);
}

export class AudioFilePlayer {
  private readonly el: HTMLAudioElement;
  private readonly opts: AudioFilePlayerOptions;
  private current: FileState = "idle";
  /** We asked it to play (a pause while this is set came from the system). */
  private want = false;
  private everPlayed = false;
  private pendingSeek: number | null = null;
  /** Last seek (s) made before the file could play — re-applied if the browser dropped it (iOS). */
  private seekTarget: number | null = null;
  private pos: number;
  private errorCode: FileErrorCode | null = null;
  private done = false;
  private disposed = false;
  private lastEmit = 0;
  private lastAdvanceAt = 0;
  private lastAdvancePos = -1;
  private watchdog: number | null = null;
  private endTimer: number | null = null;
  private readonly detach: (() => void)[] = [];

  constructor(el: HTMLAudioElement, opts: AudioFilePlayerOptions) {
    this.el = el;
    this.opts = opts;
    this.pos = this.clamp(opts.startMs ?? 0);
    const on = (type: string, fn: () => void) => {
      el.addEventListener(type, fn);
      this.detach.push(() => el.removeEventListener(type, fn));
    };
    on("playing", () => this.onPlaying());
    on("waiting", () => this.onWaiting());
    on("seeking", () => this.onWaiting());
    on("seeked", () => this.onSeeked());
    on("pause", () => this.onPause());
    on("play", () => {
      if (!this.done && !this.disposed) this.want = true;
    });
    on("ended", () => this.finish());
    on("error", () => this.onMediaError());
    on("timeupdate", () => this.onTime());
    on("progress", () => this.emit(false));
    on("loadedmetadata", () => this.applySeek());
    on("canplay", () => this.applySeek());

    try {
      el.muted = false;
      if (el.src !== opts.url) el.src = opts.url; // starts loading (preload = auto)
      const rate = opts.rate ?? 1;
      el.defaultPlaybackRate = rate;
      el.playbackRate = rate;
    } catch {
      /* reported by the media events */
    }
    this.pendingSeek = this.pos;
    this.applySeek();
    setMediaSession(!!opts.lockControls, opts.title);
  }

  get state(): FileState {
    return this.current;
  }

  get snapshot(): FileSnapshot {
    return { state: this.current, positionMs: this.pos, durationMs: this.opts.durationMs, bufferedMs: this.buffered(), error: this.errorCode };
  }

  /** Start / resume. Call synchronously inside the tap the first time (mobile autoplay rules). */
  play(): void {
    if (this.disposed || this.done) return;
    this.want = true;
    this.errorCode = null;
    this.lastAdvanceAt = Date.now();
    this.lastAdvancePos = -1;
    if (this.current !== "playing") this.set(this.everPlayed ? "buffering" : "loading");
    let p: Promise<void> | undefined;
    try {
      p = this.el.play();
    } catch (e) {
      this.rejected(e);
      return;
    }
    if (p && typeof p.catch === "function") p.catch((e: unknown) => this.rejected(e));
    this.armWatchdog();
  }

  resume(): void {
    this.play();
  }

  pause(): void {
    if (this.disposed || this.done) return;
    this.want = false;
    this.clearEndTimer();
    this.capture();
    try {
      this.el.pause();
    } catch {
      /* ignore */
    }
    this.set("paused");
  }

  /** Interrupted (page hidden): like pause, but shown as "stopped" — Continue picks up from here. */
  stop(): void {
    if (this.disposed || this.done) return;
    this.want = false;
    this.clearEndTimer();
    this.capture();
    try {
      this.el.pause();
    } catch {
      /* ignore */
    }
    if (this.current !== "error") this.set("stopped");
  }

  seek(ms: number): void {
    if (this.disposed || this.done) return;
    const target = this.clamp(ms);
    this.pos = target;
    this.seekTarget = null;
    this.clearEndTimer();
    this.lastAdvanceAt = Date.now();
    if (this.el.readyState >= 1) {
      try {
        this.el.currentTime = target / 1000;
        this.pendingSeek = null;
      } catch {
        this.pendingSeek = target;
      }
    } else this.pendingSeek = target;
    this.emit(true);
  }

  setRate(rate: number): void {
    const r = Math.min(2, Math.max(0.5, Number.isFinite(rate) && rate > 0 ? rate : 1));
    try {
      this.el.defaultPlaybackRate = r;
      this.el.playbackRate = r;
    } catch {
      /* ignore */
    }
  }

  /** After an error / stall: reload the file and continue from the same position. */
  retry(): void {
    if (this.disposed || this.done) return;
    this.pendingSeek = this.pos;
    this.errorCode = null;
    try {
      this.el.load();
    } catch {
      /* ignore */
    }
    this.set("loading");
    this.play();
  }

  /** Detach from the element (it's paused; the src stays so the next part may reuse it). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.want = false;
    this.clearEndTimer();
    this.clearWatchdog();
    this.detach.forEach((off) => off());
    try {
      this.el.pause();
    } catch {
      /* ignore */
    }
  }

  // ---- internals -----------------------------------------------------------

  private clamp(ms: number): number {
    const end = this.opts.endAtMs ?? this.opts.durationMs;
    return Math.max(0, Math.min(Number.isFinite(ms) ? ms : 0, Math.max(0, end - 250)));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error("AudioFilePlayer callback failed", e);
    }
  }

  private emit(force: boolean): void {
    const cb = this.opts.onChange;
    if (!cb || this.disposed) return;
    const now = Date.now();
    if (!force && now - this.lastEmit < EMIT_EVERY_MS) return;
    this.lastEmit = now;
    const snap = this.snapshot;
    this.safe(() => cb(snap));
  }

  private set(state: FileState): void {
    if (this.current === state) return;
    this.current = state;
    this.emit(true);
  }

  private capture(): void {
    if (this.pendingSeek != null) return;
    const t = this.el.currentTime;
    if (Number.isFinite(t)) this.pos = t * 1000;
  }

  private buffered(): number {
    try {
      const b = this.el.buffered;
      const t = this.pos / 1000;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) return b.end(i) * 1000;
    } catch {
      /* ignore */
    }
    return this.pos;
  }

  private applySeek(): void {
    if (this.disposed || this.el.readyState < 1) return;
    if (this.pendingSeek != null) {
      const target = this.pendingSeek / 1000;
      try {
        if (Math.abs(this.el.currentTime - target) > 0.05) this.el.currentTime = target;
        this.pendingSeek = null;
        this.seekTarget = target > 1 ? target : null;
      } catch {
        /* try again on canplay */
      }
      return;
    }
    // iOS can drop a seek made right after loadedmetadata and start from 0: apply it again.
    const t = this.seekTarget;
    if (t != null && this.el.currentTime < 0.5) {
      try {
        this.el.currentTime = t;
      } catch {
        /* ignore */
      }
    }
  }

  private onPlaying(): void {
    if (this.disposed || this.done) return;
    this.everPlayed = true;
    this.lastAdvanceAt = Date.now();
    this.applySeek();
    this.set("playing");
  }

  private onWaiting(): void {
    if (this.disposed || this.done || !this.want) return;
    if (this.current === "playing") this.set("buffering");
  }

  private onSeeked(): void {
    if (this.disposed || this.done) return;
    this.capture();
    if (this.want && !this.el.paused && this.el.readyState >= 3) this.set("playing");
    this.emit(true);
  }

  private onPause(): void {
    if (this.disposed || this.done || this.el.ended) return; // "ended" follows a natural end
    this.capture();
    if (this.want) {
      // Not us: the system paused it (a call, headphones unplugged, another app, media keys).
      this.want = false;
      this.clearEndTimer();
      this.set("stopped");
    }
  }

  private onTime(): void {
    if (this.disposed || this.done) return;
    if (this.seekTarget != null && this.el.currentTime >= this.seekTarget - 1) this.seekTarget = null;
    this.capture();
    const end = this.opts.endAtMs;
    if (end != null) {
      if (this.pos >= end) {
        this.finish();
        return;
      }
      const left = (end - this.pos) / Math.max(0.25, this.el.playbackRate || 1);
      if (left < 600 && !this.el.paused) this.armEndTimer(left);
    }
    this.emit(false);
  }

  private onMediaError(): void {
    if (this.disposed || this.done) return;
    const err = this.el.error;
    if (!err || err.code === 1) return; // MEDIA_ERR_ABORTED: a load we replaced
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    this.fail(err.code === 2 || offline ? "network" : err.code === 3 ? "decode" : "load");
  }

  private rejected(e: unknown): void {
    if (this.disposed || this.done || !this.want) return;
    const name = (e as { name?: unknown } | null)?.name;
    if (name === "AbortError") return; // interrupted by load() / pause(): the media events tell the rest
    if (name === "NotAllowedError") {
      this.fail("not-allowed");
      return;
    }
    // NotSupportedError: the source couldn't be loaded (offline, blocked, not found…).
    this.fail(typeof navigator !== "undefined" && navigator.onLine === false ? "network" : "load");
  }

  private fail(code: FileErrorCode): void {
    if (this.disposed || this.done) return;
    this.capture();
    this.want = false;
    this.errorCode = code;
    this.clearEndTimer();
    try {
      this.el.pause();
    } catch {
      /* ignore */
    }
    this.set("error");
    const cb = this.opts.onError;
    if (cb) this.safe(() => cb(code));
  }

  private finish(): void {
    if (this.done || this.disposed) return;
    this.done = true;
    this.want = false;
    this.clearEndTimer();
    this.clearWatchdog();
    this.capture();
    try {
      if (!this.el.paused) this.el.pause();
    } catch {
      /* ignore */
    }
    this.set("ended");
    const cb = this.opts.onEnd;
    if (cb) this.safe(cb);
  }

  private armEndTimer(ms: number): void {
    if (this.endTimer != null) return;
    this.endTimer = window.setTimeout(() => {
      this.endTimer = null;
      if (this.disposed || this.done) return;
      this.capture();
      const end = this.opts.endAtMs;
      if (end == null) return;
      if (this.pos >= end - 120) this.finish();
      else if (!this.el.paused) this.armEndTimer((end - this.pos) / Math.max(0.25, this.el.playbackRate || 1));
    }, Math.max(0, ms));
  }

  private clearEndTimer(): void {
    if (this.endTimer != null) window.clearTimeout(this.endTimer);
    this.endTimer = null;
  }

  private armWatchdog(): void {
    if (this.watchdog != null) return;
    this.watchdog = window.setInterval(() => this.checkStall(), 1000);
  }

  private clearWatchdog(): void {
    if (this.watchdog != null) window.clearInterval(this.watchdog);
    this.watchdog = null;
  }

  private checkStall(): void {
    if (this.disposed || this.done || !this.want || this.current === "error") return;
    const now = Date.now();
    const t = this.el.currentTime * 1000;
    if (!this.el.paused && Number.isFinite(t) && Math.abs(t - this.lastAdvancePos) > 1) {
      this.lastAdvancePos = t;
      this.lastAdvanceAt = now;
      return;
    }
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (now - this.lastAdvanceAt > (offline ? OFFLINE_STALL_MS : STALL_MS)) this.fail(offline ? "network" : "stalled");
  }
}
