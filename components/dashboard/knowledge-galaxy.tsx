"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Orbit, Lock } from "lucide-react";
import type { GalaxyPlanet } from "@/lib/student-intel";

// Fixed orbital positions (percent) for up to 4 planets around the centre.
const POSITIONS = [
  { top: "8%", left: "50%" },
  { top: "50%", left: "90%" },
  { top: "92%", left: "50%" },
  { top: "50%", left: "10%" },
];

function planetStyle(mastery: number, locked: boolean) {
  if (locked) return { color: "#64748b", glow: "rgba(100,116,139,0.25)" };
  if (mastery >= 78) return { color: "#00ff94", glow: "rgba(0,255,148,0.5)" };
  if (mastery >= 55) return { color: "#00e5ff", glow: "rgba(0,229,255,0.45)" };
  return { color: "#b14eff", glow: "rgba(177,78,255,0.4)" };
}

/**
 * F2 — Knowledge Galaxy. Each IELTS skill is a planet orbiting your core;
 * completed skills glow, mastered ones pulse, untouched ones stay dark. Hover
 * for mastery %, click to enter the skill. A lightweight CSS/SVG galaxy (no 3D
 * dependency), driven by real test data.
 */
export function KnowledgeGalaxy({ planets }: { planets: GalaxyPlanet[] }) {
  const active = planets.filter((p) => !p.locked).length;
  const overall = active > 0 ? Math.round(planets.reduce((s, p) => s + p.mastery, 0) / planets.length) : 0;

  return (
    <Card className="glass border-averna-purple/30 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Orbit className="h-5 w-5" /> Knowledge Galaxy
        </CardTitle>
        <p className="text-xs text-gray-400">Explore your skills as a living galaxy — hover a planet, click to enter</p>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          {/* rotating decorative orbit rings */}
          <div className="absolute inset-0 animate-[spin_60s_linear_infinite]">
            <div className="absolute inset-[10%] rounded-full border border-white/5" />
            <div className="absolute inset-[26%] rounded-full border border-white/5" />
            <div className="absolute inset-[42%] rounded-full border border-dashed border-white/5" />
          </div>

          {/* central core */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-averna-purple to-averna-neon flex items-center justify-center shadow-[0_0_30px_rgba(177,78,255,0.5)]">
              <span className="text-white font-bold text-sm">{overall}%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">You</p>
          </div>

          {/* planets */}
          {planets.map((p, i) => {
            const pos = POSITIONS[i % POSITIONS.length];
            const st = planetStyle(p.mastery, p.locked);
            const size = 34 + Math.round((p.mastery / 100) * 22); // 34-56px
            const Inner = (
              <div className="group flex flex-col items-center gap-1">
                <div
                  className={`relative rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                    p.mastery >= 78 && !p.locked ? "animate-pulse" : ""
                  }`}
                  style={{
                    height: size,
                    width: size,
                    background: p.locked
                      ? "rgba(255,255,255,0.04)"
                      : `radial-gradient(circle at 30% 30%, ${st.color}, ${st.color}22)`,
                    boxShadow: p.locked ? "none" : `0 0 18px ${st.glow}`,
                    border: `1px solid ${st.color}55`,
                  }}
                >
                  {p.locked ? (
                    <Lock className="h-3.5 w-3.5 text-gray-500" />
                  ) : (
                    <span className="text-[10px] font-bold text-white drop-shadow">{p.mastery}%</span>
                  )}
                  {/* hover tooltip */}
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.locked ? "Not started" : `${p.tests} test${p.tests === 1 ? "" : "s"} · Band ${p.avgBand}`}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300">{p.label}</span>
              </div>
            );

            return (
              <div
                key={p.key}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ top: pos.top, left: pos.left }}
              >
                {p.locked ? (
                  <Link href={p.href} title={`Start ${p.label}`}>
                    {Inner}
                  </Link>
                ) : (
                  <Link href={p.href}>{Inner}</Link>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-500">
          {active === 0 ? "Take a test to light up your first planet." : `${active}/${planets.length} skills active`}
        </p>
      </CardContent>
    </Card>
  );
}
