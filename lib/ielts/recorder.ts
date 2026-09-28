/**
 * Microphone recorder for the recorded Speaking test — one audio file per
 * answer (MediaRecorder), plus an input-level meter (Web Audio AnalyserNode).
 *
 * Client-only and framework-free: nothing touches `window` at import time.
 *
 *   const rec = new AnswerRecorder();
 *   rec.primeAudio();              // synchronously inside the click (iOS Safari)
 *   await rec.open();              // asks for the microphone once for the whole test
 *   rec.start();                   // record one answer …
 *   const take = await rec.stop(); // … → { blob, mimeType, durationMs }
 *   rec.level();                   // 0–1 input level, for a meter
 *   rec.release();                 // microphone off (the browser's indicator goes out)
 *   rec.dispose();
 *
 * Browser notes
 *  - Container: audio/webm;codecs=opus (Chrome, Edge, Firefox) → audio/mp4
 *    (Safari on iPhone / iPad / Mac, AAC) → audio/ogg; 32 kbps speech quality.
 *  - iOS Safari only runs an AudioContext created or resumed inside a user
 *    gesture, so primeAudio() must be called synchronously in the click that
 *    starts the test (the meter stays flat otherwise — recording still works).
 *  - The stream stays open between answers: no permission prompt per answer
 *    and no clipped first words.
 */

import { RECORDING_BITS_PER_SECOND } from "@/lib/speaking/shared";

export type RecorderProblem =
  /** The user or the browser refused the microphone. */
  | "not-allowed"
  /** No microphone, or it was unplugged / taken away. */
  | "no-device"
  /** Another app or tab holds the microphone. */
  | "busy"
  /** This browser can't record audio (no MediaRecorder / getUserMedia, or not https). */
  | "not-supported"
  | "unknown";

export class RecorderError extends Error {
  constructor(
    readonly code: RecorderProblem,
    message?: string
  ) {
    super(message ?? code);
    this.name = "RecorderError";
  }
}

export interface RecordedTake {
  blob: Blob;
  mimeType: string;
  /** Measured in the browser — for display only (the server measures the audio itself). */
  durationMs: number;
}

/** Preferred containers, best first. */
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
/** How long stop() waits for the last data before giving up. */
const STOP_TIMEOUT_MS = 4000;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
/** Sample buffer for the meter (typed by inference, so it fits getByteTimeDomainData on every TS lib version). */
const sampleBuffer = (n: number) => new Uint8Array(n);

/** True when this browser can record answers (MediaRecorder + getUserMedia). */
export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder === "function" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/** The best container this browser records ("" = let the browser choose). */
export function pickRecordingMimeType(): string {
  if (typeof window === "undefined" || typeof window.MediaRecorder !== "function") return "";
  const MR = window.MediaRecorder;
  if (typeof MR.isTypeSupported !== "function") return "";
  for (const type of MIME_CANDIDATES) {
    try {
      if (MR.isTypeSupported(type)) return type;
    } catch {
      /* some engines throw for unknown types */
    }
  }
  return "";
}

/** Map a getUserMedia / MediaRecorder failure to a problem the UI can explain. */
export function recorderProblemOf(err: unknown): RecorderProblem {
  if (err instanceof RecorderError) return err.code;
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "not-allowed";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "TypeError":
    case "NotSupportedError":
      return "not-supported";
    default:
      return "unknown";
  }
}

export class AnswerRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sink: GainNode | null = null;
  private samples: ReturnType<typeof sampleBuffer> | null = null;
  private smoothed = 0;
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private opening: Promise<void> | null = null;
  private mime = "";
  private disposed = false;
  private readonly problemListeners = new Set<(code: RecorderProblem) => void>();

  /** The microphone is open and live. */
  get isOpen(): boolean {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === "live");
  }

  get isRecording(): boolean {
    return !!this.media && this.media.state === "recording";
  }

  /** Container of the recordings ("" until the microphone is open, or when the browser chooses). */
  get mimeType(): string {
    return this.mime;
  }

  /** The microphone went away (unplugged, permission revoked, taken by another app). Returns an unsubscribe function. */
  onProblem(cb: (code: RecorderProblem) => void): () => void {
    this.problemListeners.add(cb);
    return () => {
      this.problemListeners.delete(cb);
    };
  }

  /**
   * Create / resume the AudioContext behind the level meter. Call it
   * synchronously inside a user gesture (a click): iOS Safari keeps an
   * AudioContext suspended otherwise.
   */
  primeAudio(): void {
    if (typeof window === "undefined" || this.disposed) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
        if (Ctx) this.ctx = new Ctx();
      }
      if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
    if (this.stream && !this.analyser) this.connectMeter();
  }

  /** Ask for the microphone (once — later calls reuse the open stream). Rejects with a RecorderError. */
  open(): Promise<void> {
    if (this.disposed) return Promise.reject(new RecorderError("unknown", "The recorder was closed."));
    if (this.isOpen) return Promise.resolve();
    if (this.opening) return this.opening;
    const run = async () => {
      if (!isRecordingSupported()) throw new RecorderError("not-supported");
      const md = navigator.mediaDevices;
      let stream: MediaStream;
      try {
        stream = await md.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      } catch (err) {
        // Engines that reject the constraints themselves get one plain request.
        const name = (err as { name?: string } | null)?.name;
        if (name !== "OverconstrainedError" && name !== "TypeError") throw new RecorderError(recorderProblemOf(err));
        try {
          stream = await md.getUserMedia({ audio: true });
        } catch (err2) {
          throw new RecorderError(recorderProblemOf(err2));
        }
      }
      if (this.disposed) {
        stream.getTracks().forEach((t) => t.stop());
        throw new RecorderError("unknown", "The recorder was closed.");
      }
      this.releaseStream();
      this.stream = stream;
      for (const track of stream.getAudioTracks()) track.addEventListener("ended", this.onTrackEnded);
      this.mime = pickRecordingMimeType();
      this.connectMeter();
    };
    const p = run().finally(() => {
      this.opening = null;
    });
    this.opening = p;
    return p;
  }

  /** Input level 0–1 (speech sits around 0.4–0.9), smoothed for a meter. 0 while the meter can't run. */
  level(): number {
    const a = this.analyser;
    const buf = this.samples;
    if (!a || !buf || !this.isOpen) {
      this.smoothed = 0;
      return 0;
    }
    try {
      a.getByteTimeDomainData(buf);
    } catch {
      return this.smoothed;
    }
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    const target = Math.max(0, Math.min(1, (db + 60) / 50)); // −60 dB → 0, −10 dB → 1
    // Rise fast, fall slowly — reads like a real meter.
    this.smoothed = target > this.smoothed ? target : this.smoothed * 0.85 + target * 0.15;
    return this.smoothed;
  }

  /** Start recording one answer. False when the microphone isn't open or recording can't start. */
  start(): boolean {
    if (this.disposed || !this.stream || !this.isOpen) return false;
    if (this.isRecording) return true;
    this.resumeAudio();
    let media: MediaRecorder;
    try {
      media = new MediaRecorder(this.stream, {
        ...(this.mime ? { mimeType: this.mime } : {}),
        audioBitsPerSecond: RECORDING_BITS_PER_SECOND,
      });
    } catch {
      try {
        media = new MediaRecorder(this.stream);
      } catch {
        return false;
      }
    }
    const chunks: Blob[] = [];
    media.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    try {
      // No timeslice: one self-contained file per answer (Safari's fragmented MP4 is safest this way).
      media.start();
    } catch {
      return false;
    }
    this.media = media;
    this.chunks = chunks;
    this.startedAt = Date.now();
    return true;
  }

  /** Stop the current answer; resolves with its recording (an empty blob when nothing was captured). */
  stop(): Promise<RecordedTake> {
    const media = this.media;
    const chunks = this.chunks;
    const durationMs = media ? Math.max(0, Date.now() - this.startedAt) : 0;
    this.media = null;
    this.chunks = [];
    return new Promise<RecordedTake>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const type = (media?.mimeType || this.mime || chunks[0]?.type || "audio/webm").trim();
        resolve({ blob: new Blob(chunks, { type }), mimeType: type, durationMs });
      };
      if (!media || media.state === "inactive") {
        finish();
        return;
      }
      // `dataavailable` (the last chunk) fires before `stop`.
      media.onstop = finish;
      media.onerror = finish;
      timer = setTimeout(finish, STOP_TIMEOUT_MS);
      try {
        media.stop();
      } catch {
        finish();
      }
    });
  }

  /** Stop the current answer and throw the recording away. */
  cancel(): void {
    const media = this.media;
    this.media = null;
    this.chunks = [];
    if (!media) return;
    media.ondataavailable = null;
    media.onstop = null;
    media.onerror = null;
    if (media.state !== "inactive") {
      try {
        media.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  /** Turn the microphone off (a later open() asks for it again). */
  release(): void {
    this.cancel();
    this.releaseStream();
  }

  dispose(): void {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
    this.problemListeners.clear();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  // -- internals ----------------------------------------------------------------

  private resumeAudio(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  }

  private readonly onTrackEnded = () => {
    if (this.disposed) return;
    this.problemListeners.forEach((cb) => {
      try {
        cb("no-device");
      } catch {
        /* a listener bug must not break the recorder */
      }
    });
  };

  private connectMeter(): void {
    this.disconnectMeter();
    const ctx = this.ctx;
    if (!ctx || !this.stream) return;
    try {
      const source = ctx.createMediaStreamSource(this.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      // A silent sink keeps the graph running in Safari without playing the microphone back.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
      this.source = source;
      this.analyser = analyser;
      this.sink = sink;
      this.samples = sampleBuffer(analyser.fftSize);
    } catch {
      this.disconnectMeter();
    }
  }

  private disconnectMeter(): void {
    for (const node of [this.source, this.analyser, this.sink]) {
      try {
        node?.disconnect();
      } catch {
        /* not connected */
      }
    }
    this.source = null;
    this.analyser = null;
    this.sink = null;
    this.samples = null;
    this.smoothed = 0;
  }

  private releaseStream(): void {
    this.disconnectMeter();
    const stream = this.stream;
    this.stream = null;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      track.removeEventListener("ended", this.onTrackEnded);
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    }
  }
}
