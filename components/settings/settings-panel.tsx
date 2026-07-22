"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Eye, EyeOff, Type, Snowflake, LogOut, Volume2, Music } from "lucide-react";

type FontScale = "sm" | "md" | "lg";

/**
 * Full-page appearance & comfort settings.
 * Uses the SAME localStorage keys and root CSS classes as the dashboard's
 * quick "Customize" panel, so changes here stay in sync everywhere:
 *   - averna_focus_mode  -> body.focus-mode
 *   - averna_text_scale  -> html.text-scale-sm / .text-scale-lg
 *   - averna_seasonal    -> seasonal decorations (via "averna-seasonal" event)
 */
export function SettingsPanel() {
  const [focus, setFocus] = useState(false);
  const [scale, setScale] = useState<FontScale>("md");
  const [seasonal, setSeasonal] = useState(true);
  const [soundUi, setSoundUi] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFocus(localStorage.getItem("averna_focus_mode") === "1");
    setScale((localStorage.getItem("averna_text_scale") as FontScale) || "md");
    setSeasonal(localStorage.getItem("averna_seasonal") !== "0");
    setSoundUi(localStorage.getItem("averna_sound_ui") === "1");
    setAmbient(localStorage.getItem("averna_sound_ambient") === "1");
  }, []);

  const applyFocus = (v: boolean) => {
    setFocus(v);
    document.body.classList.toggle("focus-mode", v);
    localStorage.setItem("averna_focus_mode", v ? "1" : "0");
  };

  const applyScale = (v: FontScale) => {
    setScale(v);
    const el = document.documentElement;
    el.classList.remove("text-scale-sm", "text-scale-lg");
    if (v === "sm") el.classList.add("text-scale-sm");
    if (v === "lg") el.classList.add("text-scale-lg");
    localStorage.setItem("averna_text_scale", v);
  };

  const applySeasonal = (v: boolean) => {
    setSeasonal(v);
    localStorage.setItem("averna_seasonal", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-seasonal"));
  };

  const applySoundUi = (v: boolean) => {
    setSoundUi(v);
    localStorage.setItem("averna_sound_ui", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-sound"));
  };

  const applyAmbient = (v: boolean) => {
    setAmbient(v);
    localStorage.setItem("averna_sound_ambient", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-sound"));
  };

  return (
    <div className="space-y-4">
      {/* Focus mode */}
      <button
        type="button"
        onClick={() => applyFocus(!focus)}
        aria-pressed={focus}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm text-white">
          {focus ? <EyeOff className="h-5 w-5 text-averna-neon" /> : <Eye className="h-5 w-5 text-gray-400" />}
          <span className="text-left">
            Focus mode
            <span className="block text-xs text-gray-400 font-normal">Hide the study pet, quests and other extras for exam-cram days</span>
          </span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${focus ? "bg-averna-neon/70" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${focus ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* Text size */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="flex items-center gap-3 text-sm text-white mb-3">
          <Type className="h-5 w-5 text-averna-cyan" /> Text size
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["sm", "md", "lg"] as FontScale[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applyScale(s)}
              aria-pressed={scale === s}
              className={`py-2.5 rounded-lg border text-sm transition-colors ${
                scale === s
                  ? "border-averna-cyan/50 bg-averna-cyan/15 text-averna-cyan"
                  : "border-white/10 text-gray-300 hover:text-white hover:border-white/20"
              }`}
            >
              {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
            </button>
          ))}
        </div>
      </div>

      {/* Seasonal effects */}
      <button
        type="button"
        onClick={() => applySeasonal(!seasonal)}
        aria-pressed={seasonal}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm text-white">
          <Snowflake className={`h-5 w-5 ${seasonal ? "text-averna-cyan" : "text-gray-400"}`} />
          <span className="text-left">
            Seasonal effects
            <span className="block text-xs text-gray-400 font-normal">Gentle falling decorations on the dashboard</span>
          </span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${seasonal ? "bg-averna-cyan/70" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${seasonal ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* UI sounds */}
      <button
        type="button"
        onClick={() => applySoundUi(!soundUi)}
        aria-pressed={soundUi}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm text-white">
          <Volume2 className={`h-5 w-5 ${soundUi ? "text-averna-neon" : "text-gray-400"}`} />
          <span className="text-left">
            Interface sounds
            <span className="block text-xs text-gray-400 font-normal">Subtle clicks and success chimes as you tap around</span>
          </span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${soundUi ? "bg-averna-neon/70" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${soundUi ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* Ambient sound */}
      <button
        type="button"
        onClick={() => applyAmbient(!ambient)}
        aria-pressed={ambient}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm text-white">
          <Music className={`h-5 w-5 ${ambient ? "text-averna-purple" : "text-gray-400"}`} />
          <span className="text-left">
            Ambient atmosphere
            <span className="block text-xs text-gray-400 font-normal">A soft, calm background pad for focused study</span>
          </span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ambient ? "bg-averna-purple/70" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${ambient ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => {
          setSigningOut(true);
          signOut({ callbackUrl: "/" });
        }}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
