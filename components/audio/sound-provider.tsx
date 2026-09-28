"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SoundEngine, type Scene, type UiPack, type UiSound } from "@/components/audio/sound-engine";

/** "click" is kept as an alias of "tap" for older callers. */
type SoundType = UiSound | "click";

export interface SoundPrefs {
  ui: boolean;
  uiPack: UiPack;
  uiVolume: number; // 0..1
  ambient: boolean;
  scene: Scene;
  ambientVolume: number; // 0..1
}

interface SoundCtx {
  prefs: SoundPrefs;
  /** Back-compat shorthands. */
  uiOn: boolean;
  ambientOn: boolean;
  /** Plays a UI sound if interface sounds are on. */
  play: (t: SoundType) => void;
  /** Plays a UI sound regardless of the toggle (Settings previews). */
  preview: (t: UiSound, pack?: UiPack) => void;
  setPrefs: (patch: Partial<SoundPrefs>) => void;
}

const DEFAULTS: SoundPrefs = {
  ui: false,
  uiPack: "soft",
  uiVolume: 0.6,
  ambient: false,
  scene: "focus",
  ambientVolume: 0.5,
};

// localStorage keys (the two on/off keys are unchanged from the first version)
const K = {
  ui: "averna_sound_ui",
  uiPack: "averna_sound_ui_pack",
  uiVolume: "averna_sound_ui_volume",
  ambient: "averna_sound_ambient",
  scene: "averna_sound_scene",
  ambientVolume: "averna_sound_ambient_volume",
} as const;

const PACKS: UiPack[] = ["soft", "glass", "minimal"];
const SCENE_KEYS: Scene[] = ["focus", "rain", "ocean", "night", "cosmos"];

function readPrefs(): SoundPrefs {
  try {
    const num = (k: string, d: number) => {
      const v = parseFloat(localStorage.getItem(k) ?? "");
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
    };
    const pack = localStorage.getItem(K.uiPack) as UiPack | null;
    const scene = localStorage.getItem(K.scene) as Scene | null;
    return {
      ui: localStorage.getItem(K.ui) === "1",
      uiPack: pack && PACKS.includes(pack) ? pack : DEFAULTS.uiPack,
      uiVolume: num(K.uiVolume, DEFAULTS.uiVolume),
      ambient: localStorage.getItem(K.ambient) === "1",
      scene: scene && SCENE_KEYS.includes(scene) ? scene : DEFAULTS.scene,
      ambientVolume: num(K.ambientVolume, DEFAULTS.ambientVolume),
    };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(p: SoundPrefs) {
  try {
    localStorage.setItem(K.ui, p.ui ? "1" : "0");
    localStorage.setItem(K.uiPack, p.uiPack);
    localStorage.setItem(K.uiVolume, String(p.uiVolume));
    localStorage.setItem(K.ambient, p.ambient ? "1" : "0");
    localStorage.setItem(K.scene, p.scene);
    localStorage.setItem(K.ambientVolume, String(p.ambientVolume));
  } catch {
    /* private mode — keep in memory only */
  }
}

const Ctx = createContext<SoundCtx | null>(null);

/**
 * Opt-in sound system (see sound-engine.ts — all synthesised, no audio files).
 * - Interface sounds: a soft tap on buttons/links (attached globally), plus
 *   chimes for toggles and success/error toasts. Three packs, own volume.
 * - Ambient atmosphere: five generative scenes with their own volume.
 * Everything is OFF by default, saved per device and changed from Settings.
 * Audio only starts after a user gesture (browser autoplay rules), the
 * AudioContext is created only once a sound is actually needed, and the
 * ambience pauses while the tab is hidden.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<SoundPrefs>(DEFAULTS);
  const [gestureReady, setGestureReady] = useState(false);
  const engineRef = useRef<SoundEngine | null>(null);
  const failed = useRef(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /** Creates the engine on first use (ideally inside a user gesture). */
  const getEngine = useCallback((): SoundEngine | null => {
    if (engineRef.current || failed.current) return engineRef.current;
    try {
      const e = new SoundEngine();
      e.setUiVolume(prefsRef.current.uiVolume);
      e.setAmbientVolume(prefsRef.current.ambientVolume);
      engineRef.current = e;
    } catch {
      failed.current = true; // Web Audio unavailable
    }
    return engineRef.current;
  }, []);

  const preview = useCallback(
    (t: UiSound, pack?: UiPack) => {
      getEngine()?.play(t, pack ?? prefsRef.current.uiPack);
    },
    [getEngine]
  );

  const play = useCallback(
    (t: SoundType) => {
      if (!prefsRef.current.ui) return;
      preview(t === "click" ? "tap" : t);
    },
    [preview]
  );

  const setPrefs = useCallback((patch: Partial<SoundPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefsState(next);
    writePrefs(next);
    window.dispatchEvent(new Event("averna-sound"));
  }, []);

  // Load prefs + stay in sync across tabs/components.
  useEffect(() => {
    const read = () => setPrefsState(readPrefs());
    read();
    const onStorage = (e: StorageEvent) => e.key?.startsWith("averna_sound") && read();
    window.addEventListener("averna-sound", read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("averna-sound", read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Every gesture (re)unlocks audio — iOS only lets a context start/resume
  // inside one — as long as some sound is switched on.
  useEffect(() => {
    const unlock = () => {
      const p = prefsRef.current;
      if (p.ui || p.ambient) getEngine()?.resume();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [getEngine]);

  // Remember that a first gesture happened (ambience may start after it).
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

  // Volumes follow the prefs live.
  useEffect(() => {
    engineRef.current?.setUiVolume(prefs.uiVolume);
    engineRef.current?.setAmbientVolume(prefs.ambientVolume);
  }, [prefs.uiVolume, prefs.ambientVolume]);

  // Global tap sound for buttons/links (skips range sliders and disabled controls).
  useEffect(() => {
    if (!prefs.ui) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("button, a, [role='button'], [role='tab']");
      if (!el || (el as HTMLButtonElement).disabled || el.hasAttribute("data-no-sound")) return;
      play("tap");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [prefs.ui, play]);

  // Toasts chime: success → success, error → error, info → notify.
  useEffect(() => {
    const onToast = (e: Event) => {
      const type = (e as CustomEvent<string>).detail;
      play(type === "success" ? "success" : type === "error" ? "error" : "notify");
    };
    window.addEventListener("averna-toast", onToast);
    return () => window.removeEventListener("averna-toast", onToast);
  }, [play]);

  // Ambient scene — runs only when enabled, after a gesture and while visible.
  useEffect(() => {
    const sync = () => {
      const want = prefs.ambient && gestureReady && document.visibilityState === "visible";
      if (!want) engineRef.current?.stopScene();
      else getEngine()?.startScene(prefs.scene);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [prefs.ambient, prefs.scene, gestureReady, getEngine]);

  // Stop everything on unmount.
  useEffect(() => () => engineRef.current?.stopScene(), []);

  return (
    <Ctx.Provider value={{ prefs, uiOn: prefs.ui, ambientOn: prefs.ambient, play, preview, setPrefs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSound(): SoundCtx {
  return (
    useContext(Ctx) ?? {
      prefs: DEFAULTS,
      uiOn: false,
      ambientOn: false,
      play: () => {},
      preview: () => {},
      setPrefs: () => {},
    }
  );
}
