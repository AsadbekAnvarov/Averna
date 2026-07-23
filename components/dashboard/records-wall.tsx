"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Lock, Timer, Swords, Ghost, Gauge, CalendarDays, Zap, BookMarked, Flame } from "lucide-react";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

interface Trophy {
  key: string;
  icon: typeof Timer;
  title: string;
  value: string;
  sub: string;
  color: string; // text color when unlocked
  unlocked: boolean;
}

/**
 * Personal Records Wall — a single trophy showcase that gathers every personal
 * best a student has set across the platform's mini-games (Focus Vault, Boss
 * Battles, Ghost Race, Confidence Meter, Word Duel, Warm-Up, Mistake Bank).
 * Unlocked records shine; the rest stay locked as clear goals to chase. Fully
 * client-side — reads the same localStorage keys those features write.
 */
export function RecordsWall() {
  const [loaded, setLoaded] = useState(false);
  const [trophies, setTrophies] = useState<Trophy[]>([]);

  useEffect(() => {
    const focus = read<{ totalMs: number; sessions: number; bestSessionMs: number }>("averna_focus_v1");
    const boss = read<{ wins: number; bestCombo: number; battlePoints: number }>("averna_boss_v1");
    const ghost = read<Record<string, { bestMs: number; splits: number[] }>>("averna_ghost_v1");
    const conf = read<{ bestScore: number; lifetime: Record<string, { c: number; t: number }> }>("averna_confidence_v1");
    const duel = read<{ byDay: Record<string, { bestCorrect: number; bestMs: number }>; streak: number }>("averna_wordduel_v1");
    const warm = read<{ streak: number; sessions: number }>("averna_warmup_v1");
    const mistakes = read<unknown[]>("averna_mistakes_v1");

    const focusMs = focus?.totalMs ?? 0;
    const focusLabel = focusMs >= 3_600_000 ? `${(focusMs / 3_600_000).toFixed(1)}h` : `${Math.round(focusMs / 60000)}m`;

    const ghostBestMs = ghost
      ? Object.values(ghost).reduce<number | null>((min, d) => (min == null ? d.bestMs : Math.min(min, d.bestMs)), null)
      : null;

    const duelBest = duel
      ? Object.values(duel.byDay ?? {}).reduce((max, d) => Math.max(max, d.bestCorrect), 0)
      : 0;

    const confAnswered = conf ? Object.values(conf.lifetime ?? {}).reduce((s, b) => s + (b?.t ?? 0), 0) : 0;
    const mistakeCount = Array.isArray(mistakes) ? mistakes.length : 0;

    const list: Trophy[] = [
      {
        key: "focus",
        icon: Timer,
        title: "Deep Focus",
        value: focusLabel,
        sub: `${focus?.sessions ?? 0} sessions sealed`,
        color: "text-indigo-300",
        unlocked: focusMs > 0,
      },
      {
        key: "focus-best",
        icon: Lock,
        title: "Longest Vault",
        value: focus?.bestSessionMs ? `${Math.round(focus.bestSessionMs / 60000)}m` : "—",
        sub: "best single session",
        color: "text-indigo-300",
        unlocked: (focus?.bestSessionMs ?? 0) > 0,
      },
      {
        key: "boss",
        icon: Swords,
        title: "Boss Slayer",
        value: boss?.bestCombo ? `${boss.bestCombo}x` : "—",
        sub: `${boss?.wins ?? 0} bosses beaten`,
        color: "text-red-300",
        unlocked: (boss?.wins ?? 0) > 0 || (boss?.bestCombo ?? 0) > 0,
      },
      {
        key: "ghost",
        icon: Ghost,
        title: "Fastest Sprint",
        value: ghostBestMs != null ? `${(ghostBestMs / 1000).toFixed(1)}s` : "—",
        sub: "best Ghost Race",
        color: "text-averna-purple",
        unlocked: ghostBestMs != null,
      },
      {
        key: "confidence",
        icon: Gauge,
        title: "Confidence",
        value: confAnswered > 0 ? `${conf?.bestScore ?? 0}` : "—",
        sub: "best calibration score",
        color: "text-amber-400",
        unlocked: confAnswered > 0,
      },
      {
        key: "duel",
        icon: CalendarDays,
        title: "Daily Duel",
        value: duelBest > 0 ? `${duelBest}/10` : "—",
        sub: duel?.streak ? `${duel.streak}-day streak` : "best daily score",
        color: "text-averna-purple",
        unlocked: duelBest > 0,
      },
      {
        key: "warmup",
        icon: Zap,
        title: "Warm-Up",
        value: warm?.streak ? `${warm.streak}` : "—",
        sub: "day warm-up streak",
        color: "text-averna-pink",
        unlocked: (warm?.sessions ?? 0) > 0,
      },
      {
        key: "mistakes",
        icon: BookMarked,
        title: "Mistakes Fixed",
        value: mistakeCount > 0 ? `${mistakeCount}` : "—",
        sub: "saved to your bank",
        color: "text-averna-cyan",
        unlocked: mistakeCount > 0,
      },
    ];

    setTrophies(list);
    setLoaded(true);
  }, []);

  const unlockedCount = trophies.filter((t) => t.unlocked).length;

  if (!loaded) {
    return (
      <Card className="glass border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-400">
            <Award className="h-5 w-5" /> Records Wall
          </CardTitle>
        </CardHeader>
        <CardContent className="h-28" />
      </Card>
    );
  }

  return (
    <Card className="glass border-amber-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-amber-400">
          <span className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Records Wall
          </span>
          <span className="text-xs font-normal text-gray-400">
            {unlockedCount}/{trophies.length} unlocked
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {trophies.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.key}
                className={`relative rounded-xl border p-3 text-center transition-all ${
                  t.unlocked
                    ? "border-white/10 bg-white/5"
                    : "border-white/5 bg-white/[0.02] grayscale opacity-60"
                }`}
              >
                {!t.unlocked && <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-gray-600" />}
                <Icon className={`h-6 w-6 mx-auto ${t.unlocked ? t.color : "text-gray-600"}`} />
                <p className={`mt-1.5 text-xl font-extrabold ${t.unlocked ? "text-white" : "text-gray-600"}`}>
                  {t.value}
                </p>
                <p className={`text-[11px] font-semibold ${t.unlocked ? t.color : "text-gray-600"}`}>{t.title}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{t.sub}</p>
              </div>
            );
          })}
        </div>
        {unlockedCount < trophies.length && (
          <p className="mt-3 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            Play the mini-games to light up every trophy.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
