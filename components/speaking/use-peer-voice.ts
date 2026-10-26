"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseIceServers, STUN_SERVERS, type IceServerConfig } from "@/lib/speaking/ice";
import { rmsOfBytes } from "@/lib/speaking/talk-time";

/**
 * Peer voice call over WebRTC (docs/peer-speaking.md, Phase B) — the former VoiceCall
 * component as a hook, without UI. Signalling goes through /api/speaking/signal:
 *
 *   - seat A (`initiator`) sends an `offer`, seat B answers; both trickle `ice`.
 *     Every attempt has a random `sid`; `gen` counts ICE restarts within it, so stale
 *     signals of an earlier attempt or page load are ignored.
 *   - B says `hello` when it (re)joins; A starts a new attempt if its offer is older
 *     than 10 s (B would otherwise see it within the 60 s signal window).
 *   - Signals are polled every 1 s while connecting/reconnecting, every 5 s after
 *     giving up (to notice the partner's Reconnect), and not at all while connected.
 *   - On `failed` (or no connection within 25 s): one automatic ICE restart (B asks A
 *     with `restart`), then status "failed" and `retry()` for a Reconnect button.
 *
 * The mic is released on hangup, unmount and pagehide. Levels are RMS 0–1 of the own
 * mic and of the partner's stream (for the talk-time balance); nothing is recorded.
 */

export type VoiceStatus = "idle" | "connecting" | "connected" | "reconnecting" | "failed";
export type MicIssue = "blocked" | "missing" | "unsupported" | null;

export interface PeerVoice {
  status: VoiceStatus;
  micIssue: MicIssue;
  muted: boolean;
  toggleMute: () => void;
  /** RMS 0–1, refreshed ~4×/s for meters. */
  localLevel: number;
  remoteLevel: number;
  localStream: MediaStream | null;
  /** The browser blocked autoplay of the partner's audio: show a "Tap to hear" button. */
  audioBlocked: boolean;
  resumeAudio: () => void;
  /** Callback ref for the <audio> element that plays the partner. */
  attachAudio: (el: HTMLAudioElement | null) => void;
  hangup: () => void;
  retry: () => void;
  /** Data channel (peer-to-peer, not stored): false when not open. */
  send: (data: string) => boolean;
  channelOpen: boolean;
}

export interface PeerVoiceOptions {
  roomId: string;
  initiator: boolean;
  /** Start the call (asks for the mic). Default true. */
  enabled?: boolean;
  /** Every ~100 ms: own and partner RMS (0–1). */
  onLevels?: (local: number, remote: number, at: number) => void;
  onMessage?: (data: string) => void;
}

const FAST_POLL_MS = 1000;
const SLOW_POLL_MS = 5000;
const CONNECT_TIMEOUT_MS = 25_000;
const DISCONNECT_GRACE_MS = 12_000;
const HELLO_RESTART_AFTER_MS = 10_000;
const LEVEL_MS = 100;
const SIGNAL_OVERLAP_MS = 3000;

interface WireSignal {
  id: string;
  kind: string;
  payload: string;
  createdAt: string;
}
interface Wire {
  sid: string;
  gen?: number;
  data?: unknown;
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function micIssueOf(e: unknown): Exclude<MicIssue, null> {
  const name = e instanceof DOMException || (e && typeof e === "object" && "name" in e) ? String((e as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  return "missing";
}

export function usePeerVoice({ roomId, initiator, enabled = true, onLevels, onMessage }: PeerVoiceOptions): PeerVoice {
  const [status, setStatusState] = useState<VoiceStatus>("idle");
  const [micIssue, setMicIssue] = useState<MicIssue>(null);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState({ local: 0, remote: 0 });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);

  const cb = useRef({ onLevels, onMessage });
  cb.current = { onLevels, onMessage };

  const r = useRef({
    /** Bumped by every start/stop, so an outdated async start gives up. */
    run: 0,
    active: false,
    status: "idle" as VoiceStatus,
    pc: null as RTCPeerConnection | null,
    stream: null as MediaStream | null,
    remote: null as MediaStream | null,
    audio: null as HTMLAudioElement | null,
    channel: null as RTCDataChannel | null,
    sid: "",
    gen: 0,
    offerAt: 0,
    descSent: false,
    outbox: [] as Wire[],
    pendingIce: [] as RTCIceCandidateInit[],
    since: null as string | null,
    seen: new Set<string>(),
    autoRetries: 0,
    lastRestartAt: 0,
    pollTimer: null as ReturnType<typeof setTimeout> | null,
    polling: false,
    connectTimer: null as ReturnType<typeof setTimeout> | null,
    levelTimer: null as ReturnType<typeof setInterval> | null,
    ice: null as IceServerConfig[] | null,
    ctx: null as AudioContext | null,
    localAnalyser: null as AnalyserNode | null,
    remoteAnalyser: null as AnalyserNode | null,
  });

  const setStatus = useCallback((s: VoiceStatus) => {
    r.current.status = s;
    setStatusState(s);
  }, []);

  const sendSignal = useCallback(
    async (kind: string, wire: Wire) => {
      try {
        await fetch("/api/speaking/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, kind, payload: JSON.stringify(wire) }),
        });
      } catch {
        /* the connect timeout / retry covers lost signals */
      }
    },
    [roomId],
  );

  // ----- audio levels -------------------------------------------------------------
  const analyserFor = useCallback((stream: MediaStream): AnalyserNode | null => {
    const s = r.current;
    try {
      if (!s.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        s.ctx = new Ctx();
      }
      const analyser = s.ctx.createAnalyser();
      analyser.fftSize = 512;
      s.ctx.createMediaStreamSource(stream).connect(analyser);
      s.ctx.resume().catch(() => undefined);
      return analyser;
    } catch {
      return null;
    }
  }, []);

  const startLevels = useCallback(() => {
    const s = r.current;
    if (s.levelTimer) return;
    const buf = new Uint8Array(512);
    let ticks = 0;
    let shown = { local: 0, remote: 0 };
    s.levelTimer = setInterval(() => {
      const read = (a: AnalyserNode | null) => {
        if (!a) return 0;
        a.getByteTimeDomainData(buf);
        return rmsOfBytes(buf);
      };
      const local = s.stream?.getAudioTracks()[0]?.enabled === false ? 0 : read(s.localAnalyser);
      const remote = read(s.remoteAnalyser);
      cb.current.onLevels?.(local, remote, Date.now());
      ticks += 1;
      if (ticks % 2 === 0) {
        const q = (v: number) => Math.round(Math.min(1, v * 4) * 20) / 20;
        const next = { local: q(local), remote: q(remote) };
        if (next.local !== shown.local || next.remote !== shown.remote) {
          shown = next;
          setLevels(next);
        }
      }
    }, LEVEL_MS);
  }, []);

  // ----- peer connection ------------------------------------------------------------
  const flushOutbox = useCallback(() => {
    const s = r.current;
    s.descSent = true;
    for (const w of s.outbox.splice(0)) void sendSignal("ice", w);
  }, [sendSignal]);

  const addIce = useCallback(async (c: RTCIceCandidateInit) => {
    const pc = r.current.pc;
    if (!pc) return;
    if (!pc.remoteDescription) {
      r.current.pendingIce.push(c);
      return;
    }
    try {
      await pc.addIceCandidate(c);
    } catch {
      /* candidates of a superseded negotiation */
    }
  }, []);

  const flushPendingIce = useCallback(async () => {
    const s = r.current;
    for (const c of s.pendingIce.splice(0)) await addIce(c);
  }, [addIce]);

  const closePc = useCallback(() => {
    const s = r.current;
    try {
      s.channel?.close();
    } catch {
      /* already closed */
    }
    s.channel = null;
    setChannelOpen(false);
    try {
      s.pc?.close();
    } catch {
      /* already closed */
    }
    s.pc = null;
    s.pendingIce = [];
    s.outbox = [];
    s.descSent = false;
  }, []);

  const clearConnectTimer = useCallback(() => {
    const s = r.current;
    if (s.connectTimer) clearTimeout(s.connectTimer);
    s.connectTimer = null;
  }, []);

  // Declared below; refs break the cycle between the failure handler and the restarts.
  const onFailedRef = useRef<() => void>(() => {});
  const ensurePollingRef = useRef<() => void>(() => {});

  const armConnectTimer = useCallback(
    (ms = CONNECT_TIMEOUT_MS) => {
      clearConnectTimer();
      r.current.connectTimer = setTimeout(() => {
        if (r.current.active && r.current.status !== "connected") onFailedRef.current();
      }, ms);
    },
    [clearConnectTimer],
  );

  const wireChannel = useCallback((ch: RTCDataChannel) => {
    const s = r.current;
    s.channel = ch;
    ch.onopen = () => setChannelOpen(true);
    ch.onclose = () => {
      setChannelOpen(false);
      // The partner left or reloaded: look for their new signals right away.
      if (s.channel === ch && s.active && s.status === "connected") {
        setStatus("reconnecting");
        ensurePollingRef.current();
        armConnectTimer(DISCONNECT_GRACE_MS);
      }
    };
    ch.onmessage = (e) => cb.current.onMessage?.(String(e.data));
  }, [armConnectTimer, setStatus]);

  const newPc = useCallback((): RTCPeerConnection => {
    const s = r.current;
    closePc();
    const pc = new RTCPeerConnection({ iceServers: (s.ice ?? STUN_SERVERS) as RTCIceServer[] });
    s.pc = pc;
    s.stream?.getTracks().forEach((t) => pc.addTrack(t, s.stream!));
    if (initiator) wireChannel(pc.createDataChannel("averna", { ordered: true }));
    else pc.ondatachannel = (e) => wireChannel(e.channel);
    pc.ontrack = (e) => {
      const remote = e.streams[0] ?? new MediaStream([e.track]);
      s.remote = remote;
      if (s.audio) {
        s.audio.srcObject = remote;
        s.audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
      }
      s.remoteAnalyser = analyserFor(remote);
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate || s.pc !== pc) return;
      const w: Wire = { sid: s.sid, gen: s.gen, data: e.candidate.toJSON() };
      if (s.descSent) void sendSignal("ice", w);
      else s.outbox.push(w);
    };
    pc.onconnectionstatechange = () => {
      if (s.pc !== pc || !s.active) return;
      const st = pc.connectionState;
      if (st === "connected") {
        clearConnectTimer();
        s.autoRetries = 0;
        setStatus("connected");
      } else if (st === "disconnected") {
        setStatus("reconnecting");
        ensurePollingRef.current();
        armConnectTimer(DISCONNECT_GRACE_MS);
      } else if (st === "failed") {
        onFailedRef.current();
      }
    };
    return pc;
  }, [analyserFor, armConnectTimer, clearConnectTimer, closePc, initiator, sendSignal, setStatus, wireChannel]);

  /** A (initiator): a new attempt with a fresh sid and offer. */
  const sendOffer = useCallback(
    async (iceRestart: boolean) => {
      const s = r.current;
      if (!iceRestart || !s.pc) {
        s.sid = randomId();
        s.gen = 0;
        newPc();
      } else {
        s.gen += 1;
        s.descSent = false;
        s.outbox = [];
      }
      const pc = s.pc!;
      s.offerAt = Date.now();
      s.lastRestartAt = Date.now();
      try {
        const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        if (s.pc !== pc) return;
        await pc.setLocalDescription(offer);
        await sendSignal("offer", { sid: s.sid, gen: s.gen, data: { type: offer.type, sdp: offer.sdp } });
        if (s.pc === pc) flushOutbox();
      } catch {
        /* the connect timer retries */
      }
    },
    [flushOutbox, newPc, sendSignal],
  );

  const onFailed = useCallback(() => {
    const s = r.current;
    if (!s.active) return;
    if (s.autoRetries < 1) {
      s.autoRetries += 1;
      setStatus("reconnecting");
      if (initiator) void sendOffer(true);
      else void sendSignal("restart", { sid: s.sid });
      ensurePollingRef.current();
      armConnectTimer();
      return;
    }
    clearConnectTimer();
    setStatus("failed");
    ensurePollingRef.current();
  }, [armConnectTimer, clearConnectTimer, initiator, sendOffer, sendSignal, setStatus]);
  onFailedRef.current = onFailed;

  // ----- signal handling --------------------------------------------------------------
  const handle = useCallback(
    async (kind: string, w: Wire) => {
      const s = r.current;
      if (initiator) {
        if (kind === "hello") {
          if (Date.now() - s.offerAt > HELLO_RESTART_AFTER_MS) {
            setStatus(s.status === "connected" ? "reconnecting" : s.status === "failed" ? "connecting" : s.status);
            s.autoRetries = 0;
            await sendOffer(false);
            armConnectTimer();
          }
        } else if (kind === "answer" && w.sid === s.sid && (w.gen ?? 0) === s.gen) {
          const pc = s.pc;
          if (!pc || pc.signalingState !== "have-local-offer") return;
          try {
            await pc.setRemoteDescription(w.data as RTCSessionDescriptionInit);
            await flushPendingIce();
          } catch {
            /* a superseded answer */
          }
        } else if (kind === "ice" && w.sid === s.sid) {
          await addIce(w.data as RTCIceCandidateInit);
        } else if (kind === "restart" && w.sid === s.sid) {
          if (Date.now() - s.lastRestartAt > 5000) {
            setStatus("reconnecting");
            await sendOffer(true);
            armConnectTimer();
          }
        }
        return;
      }
      if (kind === "offer") {
        if (w.sid !== s.sid || !s.pc) {
          s.sid = w.sid;
          newPc();
          if (s.status === "failed") setStatus("connecting");
          armConnectTimer();
        }
        s.gen = w.gen ?? 0;
        s.descSent = false;
        const pc = s.pc!;
        try {
          await pc.setRemoteDescription(w.data as RTCSessionDescriptionInit);
          await flushPendingIce();
          const answer = await pc.createAnswer();
          if (s.pc !== pc) return;
          await pc.setLocalDescription(answer);
          await sendSignal("answer", { sid: s.sid, gen: s.gen, data: { type: answer.type, sdp: answer.sdp } });
          if (s.pc === pc) flushOutbox();
        } catch {
          /* the connect timer retries */
        }
      } else if (kind === "ice" && w.sid === s.sid) {
        await addIce(w.data as RTCIceCandidateInit);
      }
    },
    [addIce, armConnectTimer, flushOutbox, flushPendingIce, initiator, newPc, sendOffer, sendSignal, setStatus],
  );

  const poll = useCallback(async () => {
    const s = r.current;
    if (!s.active) return;
    try {
      const q = new URLSearchParams({ roomId });
      if (s.since) q.set("since", s.since);
      const res = await fetch(`/api/speaking/signal?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { signals?: WireSignal[]; now?: string };
      const signals = (d.signals ?? []).filter((x) => !s.seen.has(x.id));
      signals.forEach((x) => s.seen.add(x.id));
      const parsed = signals
        .map((x) => {
          try {
            const w = JSON.parse(x.payload) as Wire;
            return w && typeof w === "object" && typeof w.sid === "string" ? { kind: x.kind, w } : null;
          } catch {
            return null;
          }
        })
        .filter((x): x is { kind: string; w: Wire } => !!x);
      // The answerer only needs the newest offer of a batch (older ones are superseded).
      const lastOffer = initiator ? -1 : parsed.map((p) => p.kind).lastIndexOf("offer");
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        if (!initiator && p.kind === "offer" && i !== lastOffer) continue;
        if (!s.active) return;
        await handle(p.kind, p.w);
      }
      const raw = d.signals ?? [];
      if (raw.length >= 50) s.since = raw[raw.length - 1].createdAt;
      else if (d.now) s.since = new Date(new Date(d.now).getTime() - SIGNAL_OVERLAP_MS).toISOString();
    } catch {
      /* the next poll retries */
    }
  }, [handle, initiator, roomId]);

  const ensurePolling = useCallback(() => {
    const s = r.current;
    if (s.polling || !s.active) return;
    s.polling = true;
    const loop = async () => {
      if (!s.active || s.status === "connected" || s.status === "idle") {
        s.polling = false;
        s.pollTimer = null;
        return;
      }
      await poll();
      // `poll` may have changed the status (TypeScript can't see that).
      if (!s.active || (s.status as VoiceStatus) === "connected") {
        s.polling = false;
        s.pollTimer = null;
        return;
      }
      s.pollTimer = setTimeout(loop, s.status === "failed" ? SLOW_POLL_MS : FAST_POLL_MS);
    };
    void loop();
  }, [poll]);
  ensurePollingRef.current = ensurePolling;

  // ----- lifecycle ------------------------------------------------------------------
  const stopAll = useCallback(() => {
    const s = r.current;
    s.run += 1;
    s.active = false;
    if (s.pollTimer) clearTimeout(s.pollTimer);
    s.pollTimer = null;
    s.polling = false;
    clearConnectTimer();
    if (s.levelTimer) clearInterval(s.levelTimer);
    s.levelTimer = null;
    closePc();
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    s.remote = null;
    if (s.audio) s.audio.srcObject = null;
    s.localAnalyser = null;
    s.remoteAnalyser = null;
    s.ctx?.close().catch(() => undefined);
    s.ctx = null;
    setLocalStream(null);
    setLevels({ local: 0, remote: 0 });
  }, [clearConnectTimer, closePc]);

  const start = useCallback(async () => {
    const s = r.current;
    if (s.active) return;
    s.active = true;
    const run = ++s.run;
    s.autoRetries = 0;
    setMicIssue(null);
    setStatus("connecting");
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setMicIssue("unsupported");
      setStatus("failed");
      s.active = false;
      return;
    }
    if (!s.ice) {
      try {
        const res = await fetch("/api/speaking/capabilities", { cache: "no-store" });
        s.ice = res.ok ? parseIceServers(((await res.json()) as { iceServers?: unknown }).iceServers) : STUN_SERVERS;
      } catch {
        s.ice = STUN_SERVERS;
      }
    }
    if (s.run !== run) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (e) {
      if (s.run !== run) return;
      setMicIssue(micIssueOf(e));
      setStatus("failed");
      s.active = false;
      return;
    }
    if (s.run !== run) {
      // Stopped (unmount / pagehide) while the permission prompt was open: release the mic.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    s.stream = stream;
    setLocalStream(s.stream);
    setMuted(false);
    s.localAnalyser = analyserFor(s.stream);
    startLevels();
    if (initiator) await sendOffer(false);
    else {
      s.sid = "";
      await sendSignal("hello", { sid: randomId() });
    }
    armConnectTimer();
    ensurePolling();
  }, [analyserFor, armConnectTimer, ensurePolling, initiator, sendOffer, sendSignal, setStatus, startLevels]);

  const hangup = useCallback(() => {
    stopAll();
    setStatus("idle");
  }, [setStatus, stopAll]);

  const retry = useCallback(() => {
    const s = r.current;
    if (!s.active || !s.stream) {
      stopAll();
      void start();
      return;
    }
    s.autoRetries = 0;
    setStatus("connecting");
    if (initiator) void sendOffer(false);
    else {
      closePc();
      s.sid = "";
      void sendSignal("hello", { sid: randomId() });
    }
    armConnectTimer();
    ensurePolling();
  }, [armConnectTimer, closePc, ensurePolling, initiator, sendOffer, sendSignal, setStatus, start, stopAll]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    const onHide = () => stopAll();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stopAll();
    };
  }, [enabled, start, stopAll]);

  const toggleMute = useCallback(() => {
    const track = r.current.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    const s = r.current;
    s.audio = el;
    if (el && s.remote) {
      el.srcObject = s.remote;
      el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    }
  }, []);

  const resumeAudio = useCallback(() => {
    const s = r.current;
    s.ctx?.resume().catch(() => undefined);
    s.audio?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, []);

  const send = useCallback((data: string) => {
    const ch = r.current.channel;
    if (!ch || ch.readyState !== "open") return false;
    try {
      ch.send(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    status,
    micIssue,
    muted,
    toggleMute,
    localLevel: levels.local,
    remoteLevel: levels.remote,
    localStream,
    audioBlocked,
    resumeAudio,
    attachAudio,
    hangup,
    retry,
    send,
    channelOpen,
  };
}
