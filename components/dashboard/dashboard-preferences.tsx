"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, X, Eye, EyeOff, Type, Snowflake, Moon, ChevronRight, BookOpenText, Ruler, type LucideIcon } from "lucide-react";
import { useComfortPrefs } from "@/components/comfort/use-comfort-prefs";
import { DEFAULT_PREFS, type TextScale } from "@/lib/comfort/prefs";
import { cn } from "@/lib/utils";

/**
 * Quick comfort panel on the dashboard ("Customize"):
 *  - Focus Mode: hides gamification widgets (pet, quests, etc.) for exam-cram days
 *  - Text size, readable font and the reading ruler: lib/comfort/prefs.ts, the
 *    same keys and <html> classes as Settings (applied before the first paint
 *    on every page by COMFORT_SCRIPT)
 *  - Seasonal effects and time-of-day ambiance
 * Preferences persist in localStorage on this device.
 */
export function DashboardPreferences() {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [seasonal, setSeasonal] = useState(true);
  const [ambiance, setAmbiance] = useState(true);
  const { prefs, update } = useComfortPrefs();
  const comfort = prefs ?? DEFAULT_PREFS;

  // Apply + persist
  const applyFocus = (v: boolean) => {
    setFocus(v);
    document.body.classList.toggle("focus-mode", v);
    localStorage.setItem("averna_focus_mode", v ? "1" : "0");
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
    setSeasonal(localStorage.getItem("averna_seasonal") !== "0");
    setAmbiance(localStorage.getItem("averna_ambiance") !== "0");
    if (f) {
      setFocus(true);
      document.body.classList.add("focus-mode");
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] lg:min-h-9 items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
        title="Comfort settings"
      >
        <Settings className="h-4 w-4" /> Customize
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="comfort-panel-title"
            className="av-modal-panel w-full max-w-sm glass-strong border border-averna-neon/30 rounded-2xl p-5 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 id="comfort-panel-title" className="font-bold text-white flex items-center gap-2"><Settings className="h-5 w-5 text-averna-neon" /> Comfort settings</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close comfort settings"
                className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Focus mode */}
            <QuickToggle
              icon={focus ? EyeOff : Eye}
              title="Focus mode"
              desc="Hide pet, quests & extras"
              on={focus}
              onChange={applyFocus}
              iconOn="text-averna-neon"
              tone="bg-averna-neon/70"
            />

            {/* Text size */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 mt-3">
              <p className="flex items-center gap-2 text-sm text-white mb-2"><Type className="h-4 w-4 text-averna-cyan" /> Text size</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Text size">
                {(["sm", "md", "lg"] as TextScale[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={comfort.textScale === s}
                    onClick={() => update({ textScale: s })}
                    className={`min-h-11 sm:min-h-9 py-2 rounded-lg border text-sm transition-colors ${
                      comfort.textScale === s ? "border-averna-cyan/50 bg-averna-cyan/15 text-averna-cyan" : "border-white/10 text-gray-300 hover:text-white"
                    }`}
                  >
                    {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
                  </button>
                ))}
              </div>
            </div>

            {/* Reading comfort */}
            <QuickToggle
              icon={BookOpenText}
              title="Readable font"
              desc="Atkinson Hyperlegible, wider spacing"
              on={comfort.font === "readable"}
              onChange={(v) => update({ font: v ? "readable" : "default" })}
              iconOn="text-averna-cyan"
              tone="bg-averna-cyan/70"
            />
            <QuickToggle
              icon={Ruler}
              title="Reading ruler"
              desc="A band that follows your finger or cursor · Alt+R"
              on={comfort.ruler === "on"}
              onChange={(v) => update({ ruler: v ? "on" : "off" })}
              iconOn="text-averna-purple"
              tone="bg-averna-purple/70"
            />

            {/* Seasonal decoration */}
            <QuickToggle
              icon={Snowflake}
              title="Seasonal effects"
              desc="Gentle falling decorations"
              on={seasonal}
              onChange={applySeasonal}
              iconOn="text-averna-cyan"
              tone="bg-averna-cyan/70"
            />

            {/* Time-of-day ambiance */}
            <QuickToggle
              icon={Moon}
              title="Time-of-day ambiance"
              desc="Warm mornings, starry nights"
              on={ambiance}
              onChange={applyAmbiance}
              iconOn="text-averna-purple"
              tone="bg-averna-purple/70"
            />

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Line spacing, contrast, sound &amp; all settings <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function QuickToggle({
  icon: Icon, title, desc, on, onChange, iconOn, tone,
}: {
  icon: LucideIcon; title: string; desc: string; on: boolean; onChange: (v: boolean) => void; iconOn: string; tone: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mt-3"
    >
      <span className="flex items-center gap-2 text-sm text-white">
        <Icon className={cn("h-4 w-4", on ? iconOn : "text-gray-400")} />
        <span className="text-left">
          {title}
          <span className="block text-[11px] text-gray-400 font-normal">{desc}</span>
        </span>
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? tone : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
