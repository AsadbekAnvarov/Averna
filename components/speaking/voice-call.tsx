"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Volume2 } from "lucide-react";

/**
 * Real-time voice call over WebRTC. Signaling goes through the DB via
 * /api/speaking/signal (polled). The "initiator" (studentA) creates the
 * offer; the other peer answers. Falls back gracefully if mic is blocked.
 */
export function VoiceCall({ roomId, isInitiator }: { roomId: string; isInitiator: boolean }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceRef = useRef<string>(new Date(Date.now() - 1000).toISOString());
  const activeRef = useRef(false);

  const cleanup = () => {
    activeRef.current = false;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const sendSignal = async (kind: string, payload: any) => {
    await fetch("/api/speaking/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, kind, payload: JSON.stringify(payload) }),
    }).catch(() => {});
  };

  const startCall = async () => {
    setErrorMsg("");
    setStatus("connecting");
    activeRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setStatus("error");
      setErrorMsg("Microphone access was blocked. Allow mic permission to talk.");
      activeRef.current = false;
      return;
    }
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    });
    pcRef.current = pc;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal("ice", e.candidate);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (activeRef.current) setStatus("connecting");
      }
    };

    // Poll for peer signals
    pollRef.current = setInterval(pollSignals, 1500);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", offer);
    }
  };

  const pollSignals = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const res = await fetch(`/api/speaking/signal?roomId=${roomId}&since=${encodeURIComponent(sinceRef.current)}`);
      if (!res.ok) return;
      const data = await res.json();
      sinceRef.current = data.now ?? sinceRef.current;
      for (const sig of data.signals ?? []) {
        const payload = JSON.parse(sig.payload);
        if (sig.kind === "offer" && !isInitiator) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", answer);
        } else if (sig.kind === "answer" && isInitiator) {
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
          }
        } else if (sig.kind === "ice") {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        }
      }
    } catch {}
  };

  const hangUp = () => {
    cleanup();
    setStatus("idle");
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  return (
    <div className="rounded-lg border border-averna-cyan/30 bg-averna-cyan/5 p-3 mb-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2 text-sm">
          <Volume2 className="h-4 w-4 text-averna-cyan" />
          {status === "idle" && <span className="text-gray-300">Voice call</span>}
          {status === "connecting" && <span className="text-averna-cyan flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Connecting voice…</span>}
          {status === "connected" && <span className="text-averna-neon">🔊 Voice connected — talk now!</span>}
          {status === "error" && <span className="text-red-300">{errorMsg}</span>}
        </span>

        <div className="flex items-center gap-2">
          {status === "connected" && (
            <Button onClick={toggleMute} size="sm" variant="outline" className={muted ? "border-red-500/50 text-red-300" : "border-averna-cyan/40 text-averna-cyan"}>
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          {status === "idle" || status === "error" ? (
            <Button onClick={startCall} size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
              <Phone className="h-4 w-4 mr-1" /> Start voice
            </Button>
          ) : (
            <Button onClick={hangUp} size="sm" variant="outline" className="border-red-500/50 text-red-300">
              <PhoneOff className="h-4 w-4 mr-1" /> End voice
            </Button>
          )}
        </div>
      </div>
      {status === "connecting" && (
        <p className="text-[11px] text-gray-500 mt-2">Tip: both students must press &ldquo;Start voice&rdquo; and allow the microphone.</p>
      )}
    </div>
  );
}
