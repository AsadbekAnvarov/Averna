"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X, Eye, EyeOff, Type, Snowflake, Moon, ChevronRight } from "lucide-react";

type FontScale = "sm" | "md" | "lg";

/**
 * Comfort & personalisation panel:
 *  - Focus Mode: hides gamification widgets (pet, quests, etc.) for exam-cram days
 *  - Text size: scales the whole UI via the root font-size
 * Preferences persist in localStorage and apply on load.
 */
export function DashboardPreferences() {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [scale, setScale] = useState<FontScale>("md");
  const [seasonal, setSeasonal] = useState(true);
  const [ambiance, setAmbiance] = useState(true);

  // Apply + persist
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
  const applyAmbiance = (v: boolean) => {
    setAmbiance(v);
    localStorage.setItem("averna_ambiance", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-ambiance"));
  };

  useEffect(() => {
    const f = localStorage.getItem("averna_focus_mode") === "1";
    const s = (localStorage.getItem("averna_text_scale") as FontScale) || "md";
    const seas = localStorage.getItem("averna_seasonal") !== "0";
    setSeasonal(seas);
    setAmbiance(localStorage.getItem("averna_ambiance") !== "0");
    if (f) {
      setFocus(true);
      document.body.classList.add("focus-mode");
    }
    if (s !== "md") {
      setScale(s);
      document.documentElement.classList.add(s === "sm" ? "text-scale-sm" : "text-scale-lg");
    }
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors"
        title="Comfort settings"
      >
        <Settings className="h-4 w-4" /> Customize
      </button>

      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="av-modal-panel fixed z-[101] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl glass-strong border border-averna-neon/30 p-4 shadow-xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:p-5"
          style={{ maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
              <Dialog.Title className="font-bold text-white flex min-w-0 items-center gap-2"><Settings className="h-5 w-5 shrink-0 text-averna-neon" /> Comfort settings</Dialog.Title>
              <Dialog.Close aria-label="Close comfort settings" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></Dialog.Close>
            </div>

            {/* Focus mode */}
            <button
              onClick={() => applyFocus(!focus)}
              aria-label="Focus mode"
              aria-pressed={focus}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-3"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                {focus ? <EyeOff className="h-4 w-4 text-averna-neon" /> : <Eye className="h-4 w-4 text-gray-400" />}
                <span className="text-left">
                  Focus mode
                  <span className="block text-[11px] text-gray-400 font-normal">Hide pet, quests & extras</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${focus ? "bg-averna-neon/70" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${focus ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>

            {/* Text size */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="flex items-center gap-2 text-sm text-white mb-2"><Type className="h-4 w-4 text-averna-cyan" /> Text size</p>
              <div className="grid grid-cols-3 gap-2">
                {(["sm", "md", "lg"] as FontScale[]).map((s) => (
                  <button
                    key={s}
                    aria-pressed={scale === s}
                    onClick={() => applyScale(s)}
                    className={`min-h-11 py-2 rounded-lg border text-sm transition-colors ${
                      scale === s ? "border-averna-cyan/50 bg-averna-cyan/15 text-averna-cyan" : "border-white/10 text-gray-300 hover:text-white"
                    }`}
                  >
                    {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
                  </button>
                ))}
              </div>
            </div>

            {/* Seasonal decoration */}
            <button
              onClick={() => applySeasonal(!seasonal)}
              aria-label="Seasonal effects"
              aria-pressed={seasonal}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mt-3"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <Snowflake className={`h-4 w-4 ${seasonal ? "text-averna-cyan" : "text-gray-400"}`} />
                <span className="text-left">
                  Seasonal effects
                  <span className="block text-[11px] text-gray-400 font-normal">Gentle falling decorations</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${seasonal ? "bg-averna-cyan/70" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${seasonal ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>

            {/* Time-of-day ambiance */}
            <button
              onClick={() => applyAmbiance(!ambiance)}
              aria-label="Time-of-day ambiance"
              aria-pressed={ambiance}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mt-3"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <Moon className={`h-4 w-4 ${ambiance ? "text-averna-purple" : "text-gray-400"}`} />
                <span className="text-left">
                  Time-of-day ambiance
                  <span className="block text-[11px] text-gray-400 font-normal">Warm mornings, starry nights</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ambiance ? "bg-averna-purple/70" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${ambiance ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Sound, theme &amp; all settings <ChevronRight className="h-4 w-4" />
            </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
