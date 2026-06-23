import { Card, CardContent } from "@/components/ui/card";
import { Star, Flame, Trophy, Target, Quote } from "lucide-react";
import { tashkentHour, getRandomQuote, getLevelInfo } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

interface HeroProps {
  name: string | null;
  image: string | null;
  points: number;
  streak: number;
  globalRank: number;
  goal: string | null;
  quote: { text: string; author: string | null } | null;
}

/**
 * A big, balanced welcome hero for the Home tab: avatar + warm time-aware
 * greeting + stat pills on the left, and a circular Level ring on the right so
 * the layout feels complete on wide screens. Brand-toned animated gradient.
 */
export function DashboardHero({ name, image, points, streak, globalRank, goal, quote }: HeroProps) {
  const firstName = name?.split(" ")[0] || "Student";
  const hour = tashkentHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";
  const initials = (name ?? "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const displayQuote = quote || { text: getRandomQuote(), author: "Averna Team" };
  const level = getLevelInfo(points);

  // Level ring geometry
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (level.into / 100) * C;

  const pills = [
    { icon: Star, label: "Points", value: points, color: "text-averna-neon", bg: "bg-averna-neon/15" },
    { icon: Flame, label: "Streak", value: streak, suffix: "d", color: "text-orange-400", bg: "bg-orange-400/15" },
    { icon: Trophy, label: "Rank", value: globalRank > 0 ? globalRank : null, prefix: "#", color: "text-amber-400", bg: "bg-amber-400/15" },
  ];

  return (
    <Card className="glass relative overflow-hidden border-averna-primary/30">
      <div className="absolute inset-0 animated-gradient opacity-60" />
      <div className="pointer-events-none absolute -top-24 -right-20 h-60 w-60 rounded-full bg-averna-neon/10 blur-3xl" />
      <CardContent className="relative p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
          {/* Left: greeting + pills + quote */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-[3px] border-averna-neon/50 flex items-center justify-center bg-averna-dark shrink-0 shadow-lg shadow-averna-neon/20">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name ?? "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-averna-neon">{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base text-gray-200">{greeting} {emoji}</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white truncate">
                  {firstName} <span className="inline-block">👋</span>
                </h2>
                {goal && (
                  <span className="inline-flex items-center gap-1.5 mt-2 text-xs sm:text-sm px-3 py-1 rounded-full bg-white/10 border border-white/15 text-averna-neon">
                    <Target className="h-4 w-4" /> {goal}
                  </span>
                )}
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3 mt-6">
              {pills.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${p.bg} ${p.color}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="leading-tight">
                      <p className={`text-xl font-bold ${p.color}`}>
                        {p.value === null ? "—" : <CountUp value={p.value} prefix={p.prefix ?? ""} suffix={p.suffix ?? ""} />}
                      </p>
                      <p className="text-[11px] text-gray-400">{p.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Daily quote */}
            <div className="mt-6 flex items-start gap-2.5 border-t border-white/10 pt-4">
              <Quote className="h-5 w-5 text-averna-cyan shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-gray-200 italic">
                &ldquo;{displayQuote.text}&rdquo; <span className="text-gray-400 not-italic">— {displayQuote.author}</span>
              </p>
            </div>
          </div>

          {/* Right: Level ring (balances the layout) */}
          <div className="flex lg:flex-col items-center justify-center gap-4 lg:gap-2 shrink-0 lg:border-l lg:border-white/10 lg:pl-8">
            <div className="relative h-36 w-36">
              <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
                <circle cx="72" cy="72" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle
                  cx="72" cy="72" r={R} fill="none"
                  stroke="url(#levelGrad)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${dash} ${C}`}
                />
                <defs>
                  <linearGradient id="levelGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#00ff94" />
                    <stop offset="100%" stopColor="#00e5ff" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Level</span>
                <span className="text-4xl font-bold neon-text leading-none">{level.level}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{level.title}</p>
              <p className="text-[11px] text-gray-400">{level.into}% to Level {level.level + 1}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
