"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

type SoundType = "click" | "toggle" | "success";

interface SoundCtx {
  uiOn: boolean;
  ambientOn: boolean;
  play: (t: SoundType) => void;
}

const Ctx = createContext<SoundCtx | null>(null);

const UI_KEY = "averna_sound_ui";
const AMBIENT_KEY = "averna_sound_ambient";

/**
 * Opt-in sound system built entirely with the Web Audio API (no audio files).
 * - "UI sounds": a subtle click on any button/link (attached globally, so no
 *   component needs editing) plus success/toggle blips.
 * - "Ambient": a soft, slowly-breathing pad for atmosphere.
 * Both are OFF by default, persisted in localStorage, and toggled from Settings
 * (which dispatches the "averna-sound" event). Everything is best-effort and
 * respects browser autoplay rules (audio only starts after a user gesture).
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [uiOn, setUiOn] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);
  const [gestureReady, setGestureReady] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<{ stop: () => void } | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        ctxRef.current = new AC();
      }
      if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const play = useCallback(
    (type: SoundType) => {
      const ctx = getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes =
        type === "success" ? [523.25, 659.25, 783.99] : type === "toggle" ? [392, 587.33] : [660];
      const peak = type === "click" ? 0.035 : 0.05;
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type === "click" ? "sine" : "triangle";
        osc.frequency.value = freq;
        const start = now + i * (type === "success" ? 0.08 : 0.05);
        const dur = type === "click" ? 0.09 : 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    },
    [getCtx]
  );

  // Load prefs + stay in sync with the Settings toggles.
  useEffect(() => {
    const read = () => {
      try {
        setUiOn(localStorage.getItem(UI_KEY) === "1");
        setAmbientOn(localStorage.getItem(AMBIENT_KEY) === "1");
      } catch {
        /* ignore */
      }
    };
    read();
    window.addEventListener("averna-sound", read);
    return () => window.removeEventListener("averna-sound", read);
  }, []);

  // Mark that a user gesture happened (unlocks audio per browser policy).
  useEffect(() => {
    if (gestureReady) return;
    const mark = () => setGestureReady(true);
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, [gestureReady]);

  // Global, non-invasive UI click sound for buttons/links.
  useEffect(() => {
    if (!uiOn) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("button, a, [role='button']");
      if (!el) return;
      if ((el as HTMLButtonElement).disabled) return;
      play("click");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [uiOn, play]);

  // Ambient pad — starts only when enabled AND a gesture has occurred.
  useEffect(() => {
    const shouldRun = ambientOn && gestureReady;
    if (!shouldRun) {
      ambientRef.current?.stop();
      ambientRef.current = null;
      return;
    }
    if (ambientRef.current) return; // already running

    const ctx = getCtx();
    if (!ctx) return;
    try {
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 620;
      filter.connect(master);
      master.connect(ctx.destination);

      // Warm, calm chord (A2, E3, A3) slightly detuned for movement.
      const freqs = [110, 164.81, 220, 220.6];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(filter);
        o.start();
        return o;
      });

      // Slow "breathing" LFO on the master gain.
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(master.gain);
      lfo.start();

      // Fade in gently.
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.026, ctx.currentTime + 2.5);

      ambientRef.current = {
        stop: () => {
          try {
            master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            const t = ctx.currentTime + 1;
            oscs.forEach((o) => o.stop(t));
            lfo.stop(t);
          } catch {
            /* ignore */
          }
        },
      };
    } catch {
      /* audio unavailable — ignore */
    }
  }, [ambientOn, gestureReady, getCtx]);

  // Clean up on unmount.
  useEffect(() => () => ambientRef.current?.stop(), []);

  return <Ctx.Provider value={{ uiOn, ambientOn, play }}>{children}</Ctx.Provider>;
}

export function useSound(): SoundCtx {
  return useContext(Ctx) ?? { uiOn: false, ambientOn: false, play: () => {} };
}
