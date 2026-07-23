"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ArrowRight, Swords } from "lucide-react";

interface Place {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  href?: string;
  tab?: string;
  from: string; // gradient start
  glow: string;
}

const PLACES: Place[] = [
  { id: "library", name: "Library", emoji: "📚", desc: "Read passages & build speed", href: "/learning/reading", from: "from-averna-cyan/25", glow: "rgba(0,229,255,0.35)" },
  { id: "studio", name: "Listening Studio", emoji: "🎧", desc: "Tune your ear to any accent", href: "/learning/listening", from: "from-averna-purple/25", glow: "rgba(177,78,255,0.35)" },
  { id: "writing", name: "Writing Center", emoji: "✍️", desc: "Craft Band-8 essays", href: "/learning/writing", from: "from-averna-pink/25", glow: "rgba(236,72,153,0.35)" },
  { id: "hall", name: "Speaking Hall", emoji: "🎤", desc: "Find your voice out loud", href: "/learning/speaking", from: "from-amber-500/25", glow: "rgba(245,158,11,0.35)" },
  { id: "lab", name: "Grammar Lab", emoji: "🧪", desc: "Experiment & master the rules", href: "/learning", from: "from-averna-neon/25", glow: "rgba(0,255,148,0.35)" },
  { id: "garden", name: "Vocabulary Garden", emoji: "🌱", desc: "Grow your word power daily", tab: "learn", from: "from-emerald-500/25", glow: "rgba(16,185,129,0.35)" },
];

/**
 * F5 — Living Campus. Turns the learning area into a set of immersive locations
 * you "enter" instead of pages you open. Each place has ambient gradient/glow
 * and routes to the relevant activity (real routes) or the right dashboard tab.
 * Lightweight (CSS only). English UI, dark-mode.
 */
export function LivingCampus() {
  const router = useRouter();

  const enter = (p: Place) => {
    if (p.href) router.push(p.href);
    else if (p.tab) window.dispatchEvent(new CustomEvent("averna-goto-tab", { detail: p.tab }));
  };

  return (
    <Card className="glass border-averna-purple/30 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <MapPin className="h-5 w-5" /> Living Campus
        </CardTitle>
        <p className="text-xs text-gray-400">Step into a location — your campus, not a menu</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {PLACES.map((p) => (
            <button
              key={p.id}
              onClick={() => enter(p)}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              style={{ ["--glow" as any]: p.glow }}
            >
              {/* ambient gradient */}
              <div
                className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${p.from} to-transparent blur-2xl opacity-70 transition-opacity duration-500 group-hover:opacity-100`}
              />
              <div
                className="relative text-3xl mb-2 transition-transform duration-500 group-hover:scale-110"
                style={{ filter: `drop-shadow(0 0 10px var(--glow))` }}
              >
                {p.emoji}
              </div>
              <p className="relative text-sm font-semibold text-white">{p.name}</p>
              <p className="relative text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
              <span className="relative mt-2 inline-flex items-center gap-1 text-[11px] text-averna-purple opacity-0 group-hover:opacity-100 transition-opacity">
                Enter <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
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
