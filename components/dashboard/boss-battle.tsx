"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Swords, Heart, Trophy, Flame, Skull, Zap, ShieldAlert } from "lucide-react";

const MISTAKES_KEY = "averna_mistakes_v1";
const STATS_KEY = "averna_boss_v1";

interface Mistake {
  id: string;
  wrong: string;
  right: string;
  note?: string;
}

interface BossStats {
  wins: number;
  bestCombo: number;
  battlePoints: number;
}

interface Question {
  m: Mistake;
  options: string[];
}

type Phase = "idle" | "fight" | "win" | "lose";

const BOSSES = [
  { name: "Tense Titan", emoji: "🕰️", color: "text-averna-purple" },
  { name: "Article Abyss", emoji: "🌀", color: "text-averna-cyan" },
  { name: "Preposition Phantom", emoji: "👻", color: "text-averna-neon" },
  { name: "Grammar Gremlin", emoji: "👹", color: "text-red-400" },
  { name: "Syntax Serpent", emoji: "🐍", color: "text-averna-neon" },
  { name: "Spelling Wraith", emoji: "🪄", color: "text-averna-purple" },
];

const MAX_HEARTS = 3;
const MIN_MISTAKES = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Boss Battles — turns the student's own Mistake Bank into a fast, dramatic
 * quiz duel. A themed "boss" attacks with one of your saved errors; you defend
 * by picking the correct fix. Right answers deal damage (streaks land crits),
 * wrong answers cost a heart. Defeat the boss to bank Battle Points.
 *
 * Fully client-side: reuses the same localStorage the Mistake Bank writes
 * (averna_mistakes_v1) so there's nothing to seed and no backend dependency.
 */
export function BossBattle() {
  const [loaded, setLoaded] = useState(false);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [stats, setStats] = useState<BossStats>({ wins: 0, bestCombo: 0, battlePoints: 0 });

  const [phase, setPhase] = useState<Phase>("idle");
  const [boss, setBoss] = useState(BOSSES[0]);
  const [bossMaxHp, setBossMaxHp] = useState(6);
  const [bossHp, setBossHp] = useState(6);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [combo, setCombo] = useState(0);
  const [runReward, setRunReward] = useState(0);

  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [bossHit, setBossHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [floatDmg, setFloatDmg] = useState<string | null>(null);

  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(MISTAKES_KEY);
      if (raw) setMistakes(JSON.parse(raw));
      const s = localStorage.getItem(STATS_KEY);
      if (s) setStats(JSON.parse(s));
    } catch {
      /* ignore */
    }
    setLoaded(true);
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      if (mounted.current) fn();
    }, ms);
    timers.current.push(t);
  }, []);

  const buildQuestion = useCallback(
    (pool: Mistake[], prevId?: string): Question => {
      const candidates = pool.length > 1 && prevId ? pool.filter((m) => m.id !== prevId) : pool;
      const m = candidates[Math.floor(Math.random() * candidates.length)];
      const distractors = shuffle(
        Array.from(new Set(pool.map((x) => x.right))).filter((r) => norm(r) !== norm(m.right)),
      ).slice(0, 3);
      const options = shuffle([m.right, ...distractors]);
      return { m, options };
    },
    [],
  );

  const startBattle = useCallback(() => {
    if (mistakes.length < MIN_MISTAKES) return;
    const chosen = BOSSES[Math.floor(Math.random() * BOSSES.length)];
    const hp = Math.min(10, Math.max(5, mistakes.length));
    setBoss(chosen);
    setBossMaxHp(hp);
    setBossHp(hp);
    setHearts(MAX_HEARTS);
    setCombo(0);
    setRunReward(0);
    setPicked(null);
    setLocked(false);
    setBossHit(false);
    setPlayerHit(false);
    setFloatDmg(null);
    setQ(buildQuestion(mistakes));
    setPhase("fight");
  }, [mistakes, buildQuestion]);

  const finishWin = useCallback(
    (finalCombo: number) => {
      const reward = bossMaxHp * 10 + finalCombo * 5;
      setRunReward(reward);
      setStats((prev) => {
        const next: BossStats = {
          wins: prev.wins + 1,
          bestCombo: Math.max(prev.bestCombo, finalCombo),
          battlePoints: prev.battlePoints + reward,
        };
        try {
          localStorage.setItem(STATS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setPhase("win");
      toast.success(`Boss defeated! +${reward} Battle Points ⚔️`);
    },
    [bossMaxHp],
  );

  const choose = (option: string) => {
    if (locked || !q) return;
    setLocked(true);
    setPicked(option);
    const correct = norm(option) === norm(q.m.right);

    if (correct) {
      const newCombo = combo + 1;
      const crit = newCombo >= 3;
      const dmg = crit ? 2 : 1;
      setCombo(newCombo);
      setBossHit(true);
      setFloatDmg(crit ? `CRIT -${dmg}` : `-${dmg}`);
      const newHp = Math.max(0, bossHp - dmg);
      setBossHp(newHp);
      later(() => {
        setBossHit(false);
        setFloatDmg(null);
        if (newHp <= 0) {
          finishWin(newCombo);
        } else {
          setPicked(null);
          setQ((prev) => buildQuestion(mistakes, prev?.m.id));
          setLocked(false);
        }
      }, 750);
    } else {
      const newHearts = hearts - 1;
      setCombo(0);
      setHearts(newHearts);
      setPlayerHit(true);
      later(() => {
        setPlayerHit(false);
        if (newHearts <= 0) {
          setPhase("lose");
        } else {
          setPicked(null);
          setQ((prev) => buildQuestion(mistakes, prev?.m.id));
          setLocked(false);
        }
      }, 1000);
    }
  };

  const bossPct = Math.round((bossHp / bossMaxHp) * 100);

  // ---- Idle / gate ----
  if (!loaded) {
    return (
      <Card className="glass border-red-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-300">
            <Swords className="h-5 w-5" /> Boss Battle
          </CardTitle>
        </CardHeader>
        <CardContent className="h-24" />
      </Card>
    );
  }

  const notEnough = mistakes.length < MIN_MISTAKES;

  if (phase === "idle") {
    return (
      <Card className="glass border-red-500/30 overflow-hidden relative">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-red-300">
            <span className="flex items-center gap-2">
              <Swords className="h-5 w-5" /> Boss Battle
            </span>
            {stats.wins > 0 && (
              <span className="flex items-center gap-3 text-xs font-normal text-gray-400">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" /> {stats.wins}
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" /> x{stats.bestCombo}
                </span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="text-6xl mb-3 select-none drop-shadow-[0_0_18px_rgba(239,68,68,0.35)]">👹</div>
          <p className="text-white font-semibold text-lg">Face your mistakes — literally.</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            A boss attacks using the errors in your Mistake Bank. Pick the correct fix to deal damage.
            Chain correct answers for critical hits. Lose 3 hearts and it&apos;s game over.
          </p>

          {notEnough ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              Save at least {MIN_MISTAKES} mistakes in the Mistake Bank to summon a boss ({mistakes.length}/{MIN_MISTAKES}).
            </div>
          ) : (
            <Button
              onClick={startBattle}
              className="mt-5 neon-button bg-red-500 hover:bg-red-500/80 text-white px-6"
            >
              <Swords className="mr-2 h-4 w-4" /> Enter Battle
            </Button>
          )}

          {stats.battlePoints > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              Lifetime: <span className="text-averna-neon font-semibold">{stats.battlePoints}</span> Battle Points earned
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---- Win ----
  if (phase === "win") {
    return (
      <Card className="glass border-averna-neon/40 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-averna-neon/5" />
        <CardContent className="text-center py-10 relative">
          <div className="text-6xl mb-3 animate-bounce select-none">🏆</div>
          <p className="text-2xl font-bold text-averna-neon">Victory!</p>
          <p className="text-sm text-gray-300 mt-1">
            You beat the <span className={boss.color}>{boss.name}</span> {boss.emoji}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-averna-neon/40 bg-averna-neon/10 px-5 py-2.5">
            <Zap className="h-5 w-5 text-averna-neon" />
            <span className="text-lg font-bold text-averna-neon">+{runReward}</span>
            <span className="text-sm text-gray-300">Battle Points</span>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={startBattle} className="neon-button bg-red-500 hover:bg-red-500/80 text-white">
              <Swords className="mr-2 h-4 w-4" /> Battle again
            </Button>
            <Button onClick={() => setPhase("idle")} variant="outline" className="border-white/20">
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Lose ----
  if (phase === "lose") {
    return (
      <Card className="glass border-red-500/40">
        <CardContent className="text-center py-10">
          <div className="text-6xl mb-3 select-none">{boss.emoji}</div>
          <p className="text-2xl font-bold text-red-300 flex items-center justify-center gap-2">
            <Skull className="h-6 w-6" /> Defeated…
          </p>
          <p className="text-sm text-gray-300 mt-2 max-w-sm mx-auto">
            The <span className={boss.color}>{boss.name}</span> knows your weak spots. Review those mistakes
            in your Mistake Bank, then come back stronger.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={startBattle} className="neon-button bg-red-500 hover:bg-red-500/80 text-white">
              <Swords className="mr-2 h-4 w-4" /> Try again
            </Button>
            <Button onClick={() => setPhase("idle")} variant="outline" className="border-white/20">
              Retreat
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Fight ----
  return (
    <Card
      className={`glass relative overflow-hidden transition-all duration-200 ${
        playerHit ? "border-red-500 ring-2 ring-red-500/60" : "border-red-500/30"
      }`}
    >
      {playerHit && <div className="pointer-events-none absolute inset-0 bg-red-500/15 animate-fade-in" />}
      <CardContent className="py-5 relative">
        {/* Boss */}
        <div className="text-center relative">
          <div
            className="text-6xl select-none transition-all duration-200"
            style={{
              transform: bossHit ? "translateY(4px) scale(0.85)" : "none",
              filter: bossHit ? "brightness(1.8) hue-rotate(-20deg)" : "none",
            }}
          >
            {boss.emoji}
          </div>
          {floatDmg && (
            <span
              className={`absolute left-1/2 top-0 -translate-x-1/2 text-lg font-extrabold animate-fade-in ${
                floatDmg.startsWith("CRIT") ? "text-amber-400" : "text-red-400"
              }`}
            >
              {floatDmg}
            </span>
          )}
          <p className={`mt-1 font-bold ${boss.color}`}>{boss.name}</p>

          {/* Boss HP */}
          <div className="mt-2 mx-auto max-w-xs">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-all duration-500"
                style={{ width: `${bossPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              {bossHp}/{bossMaxHp} HP
            </p>
          </div>
        </div>

        {/* Player status */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Heart
                key={i}
                className={`h-5 w-5 transition-all ${
                  i < hearts ? "text-red-500 fill-red-500" : "text-gray-600"
                }`}
              />
            ))}
          </div>
          {combo >= 2 && (
            <span className="flex items-center gap-1 text-sm font-bold text-orange-400 animate-fade-in">
              <Flame className="h-4 w-4" /> {combo}x combo
            </span>
          )}
        </div>

        {/* Attack / question */}
        <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-red-300 mb-1">Boss attacks with</p>
          <p className="text-base text-red-300 line-through">{q?.m.wrong}</p>
          <p className="text-xs text-gray-400 mt-2">Pick the correct version to strike back:</p>
        </div>

        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {q?.options.map((opt) => {
            const isCorrect = norm(opt) === norm(q.m.right);
            let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200";
            if (picked) {
              if (isCorrect) cls = "border-averna-neon/60 bg-averna-neon/15 text-averna-neon";
              else if (opt === picked) cls = "border-red-500/60 bg-red-500/15 text-red-300";
              else cls = "border-white/10 bg-white/5 text-gray-500 opacity-60";
            }
            return (
              <button
                key={opt}
                disabled={locked}
                onClick={() => choose(opt)}
                className={`text-left text-sm rounded-lg border px-3 py-2.5 transition-all disabled:cursor-not-allowed ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {picked && q && norm(picked) !== norm(q.m.right) && q.m.note && (
          <p className="mt-3 text-center text-xs text-gray-400 animate-fade-in">💡 {q.m.note}</p>
        )}
      </CardContent>
    </Card>
  );
}
