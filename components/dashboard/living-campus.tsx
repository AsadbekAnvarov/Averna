"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ArrowRight, Swords, Lock } from "lucide-react";
import { isSpeakingTime } from "@/lib/utils";
import type { GalaxyPlanet } from "@/lib/student-intel";

interface Theme {
  name: string;
  emoji: string;
  desc: string;
  from: string;
  glow: string;
}

// Themed "locations" for the 4 core IELTS skills (the ones we have data for).
const THEME: Record<string, Theme> = {
  READING: { name: "Library", emoji: "📚", desc: "Read passages & build speed", from: "from-averna-cyan/25", glow: "rgba(0,229,255,0.4)" },
  LISTENING: { name: "Listening Studio", emoji: "🎧", desc: "Tune your ear to any accent", from: "from-averna-purple/25", glow: "rgba(177,78,255,0.4)" },
  WRITING: { name: "Writing Center", emoji: "✍️", desc: "Craft Band-8 essays", from: "from-averna-pink/25", glow: "rgba(236,72,153,0.4)" },
  SPEAKING: { name: "Speaking Hall", emoji: "🎤", desc: "Find your voice out loud", from: "from-amber-500/25", glow: "rgba(245,158,11,0.4)" },
};

function masteryColor(m: number, locked: boolean) {
  if (locked) return "#64748b";
  if (m >= 78) return "#00ff94";
  if (m >= 55) return "#00e5ff";
  return "#b14eff";
}

/**
 * F5 — Living Campus. The single, immersive entry into the four core IELTS
 * skills: each is a "location" showing live mastery %, with a LIVE badge on the
 * Speaking Hall during speaking hours. Absorbs the old Knowledge Galaxy (mastery
 * lives here now). Data is real (per-skill mastery); routes are the real module
 * pages. Lightweight CSS, dark-mode.
 */
export function LivingCampus({ planets }: { planets: GalaxyPlanet[] }) {
  const router = useRouter();
  const speakingLive = isSpeakingTime();

  return (
    <Card className="glass border-averna-purple/30 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <MapPin className="h-5 w-5" /> Living Campus
        </CardTitle>
        <p className="text-xs text-gray-400">Step into a skill — your campus, not a menu</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {planets.map((p) => {
            const t = THEME[p.key];
            if (!t) return null;
            const color = masteryColor(p.mastery, p.locked);
            const live = p.key === "SPEAKING" && speakingLive;
            return (
              <button
                key={p.key}
                onClick={() => router.push(p.href)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                style={{ ["--glow" as any]: t.glow }}
              >
                <div className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${t.from} to-transparent blur-2xl opacity-70 transition-opacity duration-500 group-hover:opacity-100`} />
                {live && (
                  <span className="absolute top-2 right-2 z-10 text-[9px] font-bold bg-averna-neon text-black px-1.5 py-0.5 rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
                <div
                  className={`relative text-3xl mb-2 transition-transform duration-500 group-hover:scale-110 ${p.mastery >= 78 && !p.locked ? "animate-pulse" : ""}`}
                  style={{ filter: `drop-shadow(0 0 10px var(--glow))` }}
                >
                  {t.emoji}
                </div>
                <p className="relative text-sm font-semibold text-white">{t.name}</p>
                <p className="relative text-[11px] text-gray-400 mt-0.5">{t.desc}</p>

                {/* mastery */}
                <div className="relative mt-2 flex items-center gap-2">
                  {p.locked ? (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Lock className="h-3 w-3" /> Not started
                    </span>
                  ) : (
                    <>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.mastery}%`, background: color }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color }}>{p.mastery}%</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Challenge Arena — full-width feature */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("averna-goto-tab", { detail: "fun" }))}
          className="group relative w-full overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/15 via-averna-purple/10 to-transparent p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/50"
        >
          <div className="pointer-events-none absolute -top-10 right-10 h-28 w-28 rounded-full bg-red-500/20 blur-3xl opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-3">
            <span className="text-3xl transition-transform duration-500 group-hover:scale-110" style={{ filter: "drop-shadow(0 0 12px rgba(239,68,68,0.5))" }}>
              ⚔️
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                Challenge Arena <Swords className="h-3.5 w-3.5 text-red-300" />
              </p>
              <p className="text-[11px] text-gray-400">Boss Battles, Ghost Race & the daily Word Duel await</p>
            </div>
            <ArrowRight className="h-4 w-4 text-red-300 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
