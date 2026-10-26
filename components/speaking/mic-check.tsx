"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

export type MicState = "unknown" | "checking" | "ok" | "denied" | "unsupported" | "error";

const LABEL: Record<MicState, string> = {
  unknown: "Not checked yet",
  checking: "Listening…",
  ok: "Microphone works",
  denied: "Microphone blocked — allow it in your browser's site settings",
  unsupported: "This browser can't use a microphone here",
  error: "No microphone found",
};

/**
 * Mic check before matching: asks for permission, shows a live level meter, and
 * stops the microphone again when done or unmounted. Nothing is recorded or sent.
 */
export function MicCheck({
  onChange,
  stream: shared,
}: {
  onChange?: (state: MicState) => void;
  /** A live mic stream to meter instead of asking again (the peer room's call); never stopped here. */
  stream?: MediaStream | null;
}) {
  const [state, setState] = useState<MicState>("unknown");
  const [level, setLevel] = useState(0);
  const stop = useRef<() => void>(() => {});

  const update = (s: MicState) => {
    setState(s);
    onChange?.(s);
  };

  useEffect(() => {
    // Report a permission that was already granted or denied, without prompting.
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    perms
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (p.state === "denied") update("denied");
      })
      .catch(() => undefined);
    return () => stop.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = async () => {
    stop.current();
    const reuse = !!shared && shared.getAudioTracks().some((t) => t.readyState === "live");
    if (!reuse && !navigator.mediaDevices?.getUserMedia) return update("unsupported");
    update("checking");
    try {
      const stream =
        reuse && shared ? shared : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0;
      let heard = false;
      const started = Date.now();
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        const pct = Math.min(100, Math.round(rms * 400));
        setLevel(pct);
        if (pct > 8 && !heard) {
          heard = true;
          update("ok");
        }
        // Keep the meter running for 15 s, then release the microphone.
        if (Date.now() - started > 15_000) {
          stop.current();
          if (!heard) update("ok");
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      stop.current = () => {
        cancelAnimationFrame(frame);
        if (!reuse) stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => undefined);
        setLevel(0);
        stop.current = () => {};
      };
      tick();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      update(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  };

  const Icon = state === "denied" || state === "error" || state === "unsupported" ? MicOff : Mic;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${state === "ok" ? "text-averna-neon" : state === "unknown" || state === "checking" ? "text-gray-300" : "text-red-300"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Mic check</p>
          <p className="text-xs text-gray-400" role="status" aria-live="polite">
            {LABEL[state]}
          </p>
        </div>
        <button
          type="button"
          onClick={check}
          className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10"
        >
          {state === "unknown" ? "Test microphone" : "Test again"}
        </button>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level}
      >
        <div className="h-full rounded-full bg-averna-neon transition-[width] duration-75 motion-reduce:transition-none" style={{ width: `${level}%` }} />
      </div>
      {state === "checking" && <p className="mt-2 text-xs text-gray-400">Say a few words — the bar should move.</p>}
    </div>
  );
}
