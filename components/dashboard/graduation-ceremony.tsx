"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import { GraduationCap, Volume2, Trophy, TrendingUp, FileText, Star, Sparkles } from "lucide-react";

interface Props {
  reached: boolean;
  current: number | null;
  target: number | null;
  toGo: number | null;
  tests: number;
  achievements: number;
  bandDelta: number | null;
  firstBand: number | null;
  firstName: string;
}

/**
 * F6 — AI Graduation Ceremony. When the student reaches their target band, this
 * becomes a cinematic celebration: confetti, an AI congratulation speech (read
 * aloud), a stats timeline and a shareable moment. Before that, it's an
 * aspirational teaser showing exactly how close they are. Real data throughout.
 */
export function GraduationCeremony(props: Props) {
  const { reached, current, target, toGo, tests, achievements, bandDelta, firstName } = props;
  const [spoke, setSpoke] = useState(false);

  useEffect(() => {
    if (reached) fireConfetti({ particles: 160, duration: 2600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached]);

  const speech =
    `Congratulations, ${firstName}. You set out to reach Band ${target?.toFixed(1)}, and you did it. ` +
    (bandDelta && bandDelta > 0 ? `You climbed ${bandDelta.toFixed(1)} bands along the way. ` : "") +
    `Across ${tests} tests and ${achievements} achievements, you proved that consistency beats everything. ` +
    `This is the future you built — go and make it count.`;

  const play = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speech);
    const v = window.speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.onend = () => setSpoke(true);
    window.speechSynthesis.speak(u);
    setSpoke(true);
  };

  // ---- Not reached: aspirational teaser ----
  if (!reached) {
    const base = 4.0;
    const pct =
      current != null && target != null ? Math.max(0, Math.min(100, Math.round(((current - base) / Math.max(0.5, target - base)) * 100))) : 0;
    return (
      <Card className="glass border-averna-neon/30 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-averna-neon/10 blur-3xl" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-neon">
            <GraduationCap className="h-5 w-5" /> Your Graduation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 relative">
          <p className="text-sm text-gray-300">
            {target == null ? (
              <>Set a target band and your graduation goal will appear here.</>
            ) : current == null ? (
              <>Take a few tests and I'll track your journey to your Band {target.toFixed(1)} graduation.</>
            ) : (
              <>
                You're at <span className="text-white font-semibold">Band {current.toFixed(1)}</span> — just{" "}
                <span className="text-averna-neon font-semibold">{toGo?.toFixed(1)}</span> to your Band {target.toFixed(1)} graduation. Keep going. 🎓
              </>
            )}
          </p>
          {target != null && current != null && (
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---- Reached: cinematic ceremony ----
  const stats = [
    { icon: Star, label: "Band reached", value: current?.toFixed(1) ?? "—", color: "text-averna-neon" },
    { icon: TrendingUp, label: "Bands gained", value: bandDelta != null ? `${bandDelta > 0 ? "+" : ""}${bandDelta.toFixed(1)}` : "—", color: "text-averna-cyan" },
    { icon: FileText, label: "Tests done", value: tests, color: "text-averna-purple" },
    { icon: Trophy, label: "Achievements", value: achievements, color: "text-amber-400" },
  ];

  return (
    <Card className="glass border-averna-neon/50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-averna-neon/15 via-averna-purple/10 to-transparent animate-pulse" />
      <CardContent className="py-8 text-center relative">
        <div className="text-6xl mb-2 select-none animate-bounce">🎓</div>
        <p className="text-2xl font-extrabold text-averna-neon">Congratulations, {firstName}!</p>
        <p className="text-sm text-gray-300 mt-1">You reached your dream Band {target?.toFixed(1)}. 🎉</p>

        <p className="mt-4 max-w-md mx-auto text-sm text-gray-200 leading-relaxed">{speech}</p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 py-3">
                <Icon className={`h-4 w-4 mx-auto ${s.color}`} />
                <p className="text-lg font-bold text-white mt-1">{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={play} className="neon-button bg-averna-neon hover:bg-averna-neon/80 text-black">
            <Volume2 className="mr-2 h-4 w-4" /> {spoke ? "Play again" : "Hear your speech"}
          </Button>
          <span className="text-[11px] text-averna-cyan flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Screenshot to share
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
