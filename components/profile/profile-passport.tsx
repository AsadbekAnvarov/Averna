"use client";

import { getLevelInfo, initialsOf } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Share2, Flame, Trophy, Star, Target, Sparkles } from "lucide-react";

interface PassportProps {
  name: string;
  image?: string | null;
  points: number;
  currentStreak: number;
  longestStreak: number;
  globalRank: number;
  targetBand?: string;
}

/**
 * Student "passport" — a premium identity card summarising the learner's
 * level, streak, rank and target band, with a one-tap Share (Web Share API,
 * clipboard fallback). Purely presentational; level is derived from points.
 */
export function ProfilePassport({
  name,
  image,
  points,
  currentStreak,
  longestStreak,
  globalRank,
  targetBand,
}: PassportProps) {
  const lvl = getLevelInfo(points);

  // Level ring geometry
  const R = 46;
  const C = 2 * Math.PI * R;
  const dash = (lvl.into / 100) * C;

  const share = async () => {
    const text = `I'm ${name} — Level ${lvl.level} "${lvl.title}" on Averna 🎓 with ${points.toLocaleString()} points and a ${currentStreak}-day streak! 🔥`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "My Averna progress", text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Progress copied — paste it anywhere to share! 🎉");
      }
    } catch {
      /* user cancelled share — ignore */
    }
  };

  const pills = [
    { icon: Star, label: "Points", value: points.toLocaleString(), accent: "text-averna-neon" },
    { icon: Flame, label: "Streak", value: `${currentStreak}d`, accent: "text-orange-400" },
    { icon: Sparkles, label: "Best streak", value: `${longestStreak}d`, accent: "text-averna-purple" },
    { icon: Trophy, label: "Global rank", value: globalRank > 0 ? `#${globalRank}` : "—", accent: "text-averna-cyan" },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl glass-vibrant aurora-bg p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar + level ring */}
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" className="rotate-[-90deg]">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="url(#passportGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
            />
            <defs>
              <linearGradient id="passportGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00ff94" />
                <stop offset="50%" stopColor="#00e5ff" />
                <stop offset="100%" stopColor="#b14eff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={name} className="h-[86px] w-[86px] rounded-full object-cover" />
            ) : (
              <div className="h-[86px] w-[86px] rounded-full bg-averna-primary/30 grid place-items-center text-2xl font-bold text-white">
                {initialsOf(name)}
              </div>
            )}
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-averna-dark border border-averna-neon/40 text-averna-neon whitespace-nowrap">
            LVL {lvl.level}
          </span>
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold truncate">
            <span className="text-gradient">{name || "Student"}</span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="text-sm px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white">
              {lvl.title}
            </span>
            {targetBand && (
              <span className="text-sm px-2.5 py-0.5 rounded-full bg-averna-cyan/10 border border-averna-cyan/30 text-averna-cyan flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> Target {targetBand}
              </span>
            )}
          </div>

          {/* Level progress */}
          <div className="mt-4 max-w-sm mx-auto sm:mx-0">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-averna-neon via-averna-cyan to-averna-purple transition-all"
                style={{ width: `${lvl.into}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {lvl.isMax ? `Top level reached — ${lvl.title}! 🏆` : `${lvl.into}% toward Level ${lvl.level + 1}`}
            </p>
          </div>
        </div>

        {/* Share */}
        <div className="shrink-0">
          <Button onClick={share} className="neon-button bg-averna-primary hover:bg-averna-light">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      {/* Stat pills */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pills.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.label} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
              <Icon className={`h-4 w-4 mx-auto mb-1 ${p.accent}`} />
              <p className={`text-lg font-bold ${p.accent}`}>{p.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{p.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
