"use client";

import { useEffect, useState } from "react";
import { Settings, X, Eye, EyeOff, Type, Snowflake } from "lucide-react";

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

  useEffect(() => {
    const f = localStorage.getItem("averna_focus_mode") === "1";
    const s = (localStorage.getItem("averna_text_scale") as FontScale) || "md";
    const seas = localStorage.getItem("averna_seasonal") !== "0";
    setSeasonal(seas);
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
        title="Comfort settings"
      >
        <Settings className="h-4 w-4" /> Customize
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm glass-strong border border-averna-neon/30 rounded-2xl p-5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Settings className="h-5 w-5 text-averna-neon" /> Comfort settings</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {/* Focus mode */}
            <button
              onClick={() => applyFocus(!focus)}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-3"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                {focus ? <EyeOff className="h-4 w-4 text-averna-neon" /> : <Eye className="h-4 w-4 text-gray-400" />}
                <span className="text-left">
                  Focus mode
                  <span className="block text-[11px] text-gray-400 font-normal">Hide pet, quests & extras</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${focus ? "bg-averna-neon/70" : "bg-white/15"}`}>
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
                    onClick={() => applyScale(s)}
                    className={`py-2 rounded-lg border text-sm transition-colors ${
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
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mt-3"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <Snowflake className={`h-4 w-4 ${seasonal ? "text-averna-cyan" : "text-gray-400"}`} />
                <span className="text-left">
                  Seasonal effects
                  <span className="block text-[11px] text-gray-400 font-normal">Gentle falling decorations</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${seasonal ? "bg-averna-cyan/70" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${seasonal ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
