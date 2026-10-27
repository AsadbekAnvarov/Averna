"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rmsOfBytes } from "@/lib/speaking/talk-time";
import { liveStats, type LiveLogprob, type LiveStats, type LiveTurn } from "@/lib/realtime/stats";
import type { LiveMode } from "@/lib/realtime/modes";

/**
 * One live call with the AI speaking partner (docs/elegance-roadmap.md, idea 3).
 *
 * WebRTC, server-mediated: the mic track and the "oai-events" data channel are added
 * BEFORE the offer; the offer goes to POST /api/coach/live/start, which answers with
 * OpenAI's SDP (the API key never reaches the browser). Captions come over the data
 * channel: the student's from input transcription events (with logprobs for the
 * pronunciation map), the partner's from output audio transcript events.
 *
 *   - Countdown from X-Live-Seconds; a calm cue at 1:00; the call ends itself at 0:00
 *     (the server hangs up 5 s later anyway).
 *   - Network drop: 6 s grace, then ONE reconnect (a new call — the server replaces the
 *     old one); if that fails too, the call ends and the transcript is kept.
 *   - Tab hidden: nothing changes. Page closed: /end with keepalive.
 *   - A phone call (or the OS) muting the mic: "paused" until the track unmutes.
 *   - Mute disables the mic track (the partner then hears silence).
 * Nothing is recorded; the transcript stays in this tab's memory.
 */

export type CallPhase = "idle" | "connecting" | "live" | "reconnecting" | "ending" | "ended" | "failed";
export type CallProblem = "mic-blocked" | "mic-missing" | "unsupported" | "limit" | "server" | "network";
export type EndReason = "student" | "limit" | "network";

export interface LiveCaption {
  id: string;
  who: "me" | "ai";
  text: string;
  final: boolean;
}

export interface EndedCall {
  turns: LiveTurn[];
  stats: LiveStats;
  reason: EndReason;
  topicLabel: string;
  /** /api/coach/live/end's answer (null when it failed). */
  server: { seconds: number; xp: number; xpNote: string | null; remainingSec: number } | null;
}

export interface LiveCallOptions {
  mode: LiveMode;
  topicId: string;
  topicLabel: string;
  onEnded: (call: EndedCall) => void;
}

interface Entry {
  id: string;
  who: "me" | "ai";
  text: string;
  partial: string;
  final: boolean;
  speechMs: number;
  logprobs: LiveLogprob[] | null;
}

const RECONNECT_GRACE_MS = 6_000;
const ONE_MINUTE = 60;
const MAX_ENTRIES = 300;

type CtxCtor = typeof AudioContext;
const audioContextCtor = (): CtxCtor | null =>
  typeof window === "undefined" ? null : window.AudioContext || (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext || null;

let primed: AudioContext | null = null;

/**
 * Create (or resume) the call's AudioContext synchronously inside the Start click:
 * iOS Safari keeps contexts made outside a user gesture suspended (the orb would stay still).
 */
export function primeLiveAudio(): void {
  try {
    const Ctx = audioContextCtor();
    if (!Ctx) return;
    if (!primed || primed.state === "closed") primed = new Ctx();
    void primed.resume().catch(() => undefined);
  } catch {
    primed = null;
  }
}

function micProblemOf(e: unknown): CallProblem {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "mic-blocked";
  return "mic-missing";
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function logprobsOf(v: unknown): LiveLogprob[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((x) => x && typeof x === "object" && typeof (x as { token?: unknown }).token === "string" && num((x as { logprob?: unknown }).logprob) != null)
    .map((x) => ({ token: (x as { token: string }).token, logprob: (x as { logprob: number }).logprob }));
  return out.length ? out : null;
}

export function useLiveCall({ mode, topicId, topicLabel, onEnded }: LiveCallOptions) {
  const [phase, setPhaseState] = useState<CallPhase>("idle");
  const [problem, setProblem] = useState<CallProblem | null>(null);
  const [problemText, setProblemText] = useState("");
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const [announce, setAnnounce] = useState("");
  const [muted, setMuted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [oneMinuteLeft, setOneMinuteLeft] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micInterrupted, setMicInterrupted] = useState(false);
  const [topic, setTopic] = useState(topicLabel);

  const cb = useRef({ onEnded });
  cb.current = { onEnded };

  const r = useRef({
    phase: "idle" as CallPhase,
    run: 0,
    ended: false,
    pc: null as RTCPeerConnection | null,
    dc: null as RTCDataChannel | null,
    stream: null as MediaStream | null,
    audio: null as HTMLAudioElement | null,
    ctx: null as AudioContext | null,
    localAnalyser: null as AnalyserNode | null,
    remoteAnalyser: null as AnalyserNode | null,
    levelTimer: null as ReturnType<typeof setInterval> | null,
    clockTimer: null as ReturnType<typeof setInterval> | null,
    graceTimer: null as ReturnType<typeof setTimeout> | null,
    callId: null as string | null,
    deadline: 0,
    startedAt: 0,
    reconnected: false,
    cueShown: false,
    topic: topicLabel,
    entries: [] as Entry[],
    speechStart: new Map<string, number>(),
    levels: { local: 0, remote: 0 },
  });

  const setPhase = useCallback((p: CallPhase) => {
    r.current.phase = p;
    setPhaseState(p);
  }, []);

  // ----- transcript -------------------------------------------------------------------
  const publish = useCallback(() => {
    const list = r.current.entries
      .filter((e) => (e.final ? e.text : e.partial).trim())
      .map((e) => ({ id: e.id, who: e.who, text: e.final ? e.text : e.partial, final: e.final }));
    setCaptions(list);
  }, []);

  const entry = useCallback((id: string, who: "me" | "ai"): Entry => {
    const s = r.current;
    let e = s.entries.find((x) => x.id === id && x.who === who);
    if (!e) {
      e = { id, who, text: "", partial: "", final: false, speechMs: 0, logprobs: null };
      s.entries.push(e);
      if (s.entries.length > MAX_ENTRIES) s.entries.splice(0, s.entries.length - MAX_ENTRIES);
    }
    return e;
  }, []);

  const handleEvent = useCallback(
    (data: string) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      const s = r.current;
      const itemId = typeof ev.item_id === "string" ? ev.item_id : typeof ev.response_id === "string" ? ev.response_id : "";
      switch (ev.type) {
        case "session.created":
        case "session.updated":
          if (s.phase === "connecting" || s.phase === "reconnecting") setPhase("live");
          break;
        case "input_audio_buffer.speech_started": {
          if (!itemId) break;
          entry(itemId, "me");
          const at = num(ev.audio_start_ms);
          if (at != null) s.speechStart.set(itemId, at);
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          if (!itemId) break;
          const from = s.speechStart.get(itemId);
          const to = num(ev.audio_end_ms);
          if (from != null && to != null && to > from) entry(itemId, "me").speechMs += to - from;
          s.speechStart.delete(itemId);
          break;
        }
        case "conversation.item.input_audio_transcription.delta": {
          if (!itemId || typeof ev.delta !== "string") break;
          const e = entry(itemId, "me");
          if (!e.final) e.partial += ev.delta;
          publish();
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          if (!itemId) break;
          const e = entry(itemId, "me");
          e.text = typeof ev.transcript === "string" ? ev.transcript.trim() : e.partial.trim();
          e.final = true;
          e.logprobs = logprobsOf(ev.logprobs);
          publish();
          if (e.text) setAnnounce(`You: ${e.text}`);
          break;
        }
        case "conversation.item.input_audio_transcription.failed": {
          if (!itemId) break;
          const e = entry(itemId, "me");
          e.final = true;
          e.text = e.partial.trim();
          publish();
          break;
        }
        case "response.output_audio_transcript.delta": {
          if (!itemId || typeof ev.delta !== "string") break;
          const e = entry(itemId, "ai");
          if (!e.final) e.partial += ev.delta;
          publish();
          break;
        }
        case "response.output_audio_transcript.done": {
          if (!itemId) break;
          const e = entry(itemId, "ai");
          e.text = typeof ev.transcript === "string" ? ev.transcript.trim() : e.partial.trim();
          e.final = true;
          publish();
          if (e.text) setAnnounce(`Partner: ${e.text}`);
          break;
        }
        default:
          break;
      }
    },
    [entry, publish, setPhase],
  );

  // ----- audio ------------------------------------------------------------------------
  const analyserFor = useCallback((stream: MediaStream): AnalyserNode | null => {
    const s = r.current;
    try {
      if (!s.ctx) return null;
      const a = s.ctx.createAnalyser();
      a.fftSize = 512;
      s.ctx.createMediaStreamSource(stream).connect(a);
      return a;
    } catch {
      return null;
    }
  }, []);

  const startLevels = useCallback(() => {
    const s = r.current;
    if (s.levelTimer) return;
    const buf = new Uint8Array(512);
    const read = (a: AnalyserNode | null) => {
      if (!a) return 0;
      a.getByteTimeDomainData(buf);
      return Math.min(1, rmsOfBytes(buf) * 4);
    };
    s.levelTimer = setInterval(() => {
      const localOn = s.stream?.getAudioTracks()[0]?.enabled !== false;
      s.levels = { local: localOn ? read(s.localAnalyser) : 0, remote: read(s.remoteAnalyser) };
    }, 100);
  }, []);

  // ----- teardown ---------------------------------------------------------------------
  const closeConnection = useCallback(() => {
    const s = r.current;
    if (s.graceTimer) clearTimeout(s.graceTimer);
    s.graceTimer = null;
    try {
      s.dc?.close();
    } catch {
      /* closed */
    }
    s.dc = null;
    try {
      s.pc?.close();
    } catch {
      /* closed */
    }
    s.pc = null;
    s.remoteAnalyser = null;
    if (s.audio) s.audio.srcObject = null;
  }, []);

  const releaseAll = useCallback(() => {
    const s = r.current;
    closeConnection();
    if (s.levelTimer) clearInterval(s.levelTimer);
    s.levelTimer = null;
    if (s.clockTimer) clearInterval(s.clockTimer);
    s.clockTimer = null;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    s.localAnalyser = null;
    s.ctx?.close().catch(() => undefined);
    s.ctx = null;
    s.levels = { local: 0, remote: 0 };
  }, [closeConnection]);

  /** Tell the server the call ended (fire-and-forget on pagehide). */
  const sendEnd = useCallback(async (body: Record<string, unknown>, keepalive = false) => {
    try {
      const res = await fetch("/api/coach/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });
      if (!res.ok) return null;
      return (await res.json()) as { seconds: number; xp: number; xpNote: string | null; remainingSec: number };
    } catch {
      return null;
    }
  }, []);

  const finish = useCallback(
    async (reason: EndReason) => {
      const s = r.current;
      if (s.ended) return;
      s.ended = true;
      s.run += 1;
      setPhase("ending");
      const callSec = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;
      releaseAll();
      // Unfinished captions keep what was heard so far (without clarity scores).
      for (const e of s.entries)
        if (!e.final) {
          e.text = e.partial.trim();
          e.final = true;
          e.logprobs = null;
        }
      const turns: LiveTurn[] = s.entries
        .filter((e) => e.text)
        .map((e) => ({ id: e.id, who: e.who, text: e.text, speechMs: e.who === "me" ? e.speechMs || null : null, logprobs: e.logprobs }));
      const stats = liveStats(turns, callSec);
      const server = s.callId ? await sendEnd({ id: s.callId, reason, speechSec: stats.mySpeechSec, words: stats.words }) : null;
      setPhase("ended");
      cb.current.onEnded({ turns, stats, reason, topicLabel: s.topic, server });
    },
    [releaseAll, sendEnd, setPhase],
  );

  const fail = useCallback(
    (p: CallProblem, text = "") => {
      const s = r.current;
      s.run += 1;
      releaseAll();
      setProblem(p);
      setProblemText(text);
      setPhase("failed");
    },
    [releaseAll, setPhase],
  );

  // ----- connect ----------------------------------------------------------------------
  const reconnectRef = useRef<() => void>(() => {});

  const connect = useCallback(
    async (resumed: boolean): Promise<boolean> => {
      const s = r.current;
      const run = ++s.run;
      const stream = s.stream;
      if (!stream) return false;
      const pc = new RTCPeerConnection();
      s.pc = pc;
      pc.ontrack = (e) => {
        const remote = e.streams[0] ?? new MediaStream([e.track]);
        if (s.audio) {
          s.audio.srcObject = remote;
          s.audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
        s.remoteAnalyser = analyserFor(remote);
      };
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
      const dc = pc.createDataChannel("oai-events");
      s.dc = dc;
      dc.onmessage = (e) => handleEvent(String(e.data));
      dc.onopen = () => {
        if (s.dc !== dc) return;
        if (s.phase === "connecting" || s.phase === "reconnecting") setPhase("live");
        try {
          // The partner speaks first (the instructions say how to open or resume).
          dc.send(JSON.stringify({ type: "response.create" }));
        } catch {
          /* closed */
        }
      };
      pc.onconnectionstatechange = () => {
        if (s.pc !== pc || s.ended) return;
        const st = pc.connectionState;
        if (st === "connected") {
          if (s.graceTimer) clearTimeout(s.graceTimer);
          s.graceTimer = null;
          if (s.phase === "reconnecting" || s.phase === "connecting") setPhase("live");
        } else if (st === "disconnected") {
          setPhase("reconnecting");
          if (!s.graceTimer) s.graceTimer = setTimeout(() => reconnectRef.current(), RECONNECT_GRACE_MS);
        } else if (st === "failed") {
          reconnectRef.current();
        }
      };

      let res: Response;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (s.run !== run) return false;
        res = await fetch("/api/coach/live/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: offer.sdp, mode, topicId, resumed }),
        });
      } catch {
        if (s.run === run && !resumed) fail("network", "Couldn't reach Averna. Check your connection and try again.");
        return false;
      }
      if (s.run !== run) return false;
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!resumed) fail(res.status === 429 ? "limit" : "server", d?.error || "The live partner didn't pick up. Try again in a moment.");
        return false;
      }
      const answer = await res.text();
      const id = res.headers.get("X-Live-Call");
      const seconds = Number(res.headers.get("X-Live-Seconds")) || 0;
      const label = res.headers.get("X-Live-Topic");
      if (label) {
        try {
          s.topic = decodeURIComponent(label);
          setTopic(s.topic);
        } catch {
          /* keep the chosen label */
        }
      }
      s.callId = id;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch {
        if (id) void sendEnd({ id, reason: "network" });
        if (s.run === run && !resumed) fail("server", "The call couldn't connect. Try again in a moment.");
        return false;
      }
      if (s.run !== run) {
        // Cancelled while the answer was applied (the screen closed): end that call too.
        if (id) void sendEnd({ id, reason: "student" }, true);
        return false;
      }
      const now = Date.now();
      s.deadline = resumed ? Math.min(s.deadline, now + seconds * 1000) : now + seconds * 1000;
      if (!s.startedAt) s.startedAt = now;
      return true;
    },
    [analyserFor, fail, handleEvent, mode, sendEnd, setPhase, topicId],
  );

  const reconnect = useCallback(async () => {
    const s = r.current;
    if (s.ended || s.phase === "ending") return;
    if (s.graceTimer) clearTimeout(s.graceTimer);
    s.graceTimer = null;
    if (s.reconnected || s.deadline - Date.now() < 20_000) {
      void finish("network");
      return;
    }
    s.reconnected = true;
    setPhase("reconnecting");
    closeConnection();
    // The new start replaces (settles and hangs up) the dropped call on the server.
    const ok = await connect(true);
    if (!ok && !r.current.ended) void finish("network");
  }, [closeConnection, connect, finish, setPhase]);
  reconnectRef.current = () => void reconnect();

  const tick = useCallback(() => {
    const s = r.current;
    if (!s.deadline || s.ended) return;
    const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
    setSecondsLeft(left);
    if (left <= ONE_MINUTE && !s.cueShown) {
      s.cueShown = true;
      setOneMinuteLeft(true);
    }
    if (left <= 0) void finish("limit");
  }, [finish]);

  /** Start the call — call it from the Start button's click (iOS needs the gesture for audio). */
  const start = useCallback(async () => {
    const s = r.current;
    if (s.phase !== "idle" && s.phase !== "failed") return;
    s.ended = false;
    s.reconnected = false;
    s.cueShown = false;
    s.entries = [];
    s.speechStart.clear();
    s.callId = null;
    s.startedAt = 0;
    s.deadline = 0;
    setCaptions([]);
    setAnnounce("");
    setProblem(null);
    setProblemText("");
    setOneMinuteLeft(false);
    setSecondsLeft(null);
    setMuted(false);
    setPhase("connecting");
    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      fail("unsupported");
      return;
    }
    // The Start click primed a context (primeLiveAudio); otherwise make one here.
    try {
      const Ctx = audioContextCtor();
      s.ctx = primed && primed.state !== "closed" ? primed : Ctx ? new Ctx() : null;
      primed = null;
      void s.ctx?.resume().catch(() => undefined);
    } catch {
      s.ctx = null;
    }
    const run = s.run;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      if (s.run === run) fail(micProblemOf(e));
      return;
    }
    if (s.run !== run) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    s.stream = stream;
    const track = stream.getAudioTracks()[0];
    if (track) {
      // A phone call or the OS takes the mic: pause until it comes back.
      track.onmute = () => setMicInterrupted(true);
      track.onunmute = () => setMicInterrupted(false);
      track.onended = () => {
        if (!r.current.ended && r.current.phase !== "idle") void finish("network");
      };
    }
    s.localAnalyser = analyserFor(stream);
    startLevels();
    const ok = await connect(false);
    if (!ok) return;
    if (s.clockTimer) clearInterval(s.clockTimer);
    s.clockTimer = setInterval(tick, 500);
    tick();
  }, [analyserFor, connect, fail, finish, setPhase, startLevels, tick]);

  const end = useCallback((reason: EndReason = "student") => void finish(reason), [finish]);

  const toggleMute = useCallback(() => {
    const track = r.current.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    r.current.audio = el;
  }, []);

  const resumeAudio = useCallback(() => {
    const s = r.current;
    s.ctx?.resume().catch(() => undefined);
    s.audio?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, []);

  /** Mic and partner levels 0–1 (for the orb; read in an animation frame, no re-render). */
  const levels = useCallback(() => r.current.levels, []);

  // Page closed, or the screen unmounted mid-call: cancel what is in flight, release the
  // mic and end the call on the server too (keepalive). Back to "idle", so a React
  // StrictMode remount in development can simply start again.
  useEffect(() => {
    const leave = () => {
      const s = r.current;
      if (s.ended || (s.phase !== "live" && s.phase !== "reconnecting" && s.phase !== "connecting")) return;
      s.run += 1;
      if (s.callId) void sendEnd({ id: s.callId, reason: "student" }, true);
      s.callId = null;
      releaseAll();
      s.phase = "idle";
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [releaseAll, sendEnd]);

  // Back online after a drop: try the reconnect right away instead of waiting.
  useEffect(() => {
    const online = () => {
      if (r.current.phase === "reconnecting" && r.current.pc?.connectionState !== "connected") reconnectRef.current();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  return {
    phase,
    problem,
    problemText,
    captions,
    announce,
    muted,
    toggleMute,
    secondsLeft,
    oneMinuteLeft,
    audioBlocked,
    resumeAudio,
    micInterrupted,
    topic,
    attachAudio,
    levels,
    start,
    end,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
