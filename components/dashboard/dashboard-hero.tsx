import { Card, CardContent } from "@/components/ui/card";
import { Star, Flame, Trophy, Target, Quote } from "lucide-react";
import { tashkentHour, getRandomQuote } from "@/lib/utils";
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
 * A beautiful welcome hero for the Home tab: animated gradient, avatar, a warm
 * time-aware greeting, glass stat pills (points / streak / rank) and the daily
 * quote — the first thing the student sees.
 */
export function DashboardHero({ name, image, points, streak, globalRank, goal, quote }: HeroProps) {
  const firstName = name?.split(" ")[0] || "Student";
  const hour = tashkentHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";
  const initials = (name ?? "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const displayQuote = quote || { text: getRandomQuote(), author: "Averna Team" };

  const pills = [
    { icon: Star, label: "Points", value: points, color: "text-averna-neon", bg: "bg-averna-neon/15" },
    { icon: Flame, label: "Streak", value: streak, suffix: "d", color: "text-orange-400", bg: "bg-orange-400/15" },
    { icon: Trophy, label: "Rank", value: globalRank > 0 ? globalRank : null, prefix: "#", color: "text-amber-400", bg: "bg-amber-400/15" },
  ];

  return (
    <Card className="glass relative overflow-hidden border-averna-primary/30">
      <div className="absolute inset-0 animated-gradient opacity-70" />
      <div className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full bg-averna-neon/15 blur-3xl" />
      <CardContent className="relative p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-[3px] border-averna-neon/50 flex items-center justify-center bg-averna-dark shrink-0 shadow-lg shadow-averna-neon/20">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={name ?? "Avatar"} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-averna-neon">{initials}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-200">{greeting} {emoji}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {firstName} <span className="inline-block">👋</span>
            </h2>
            {goal && (
              <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-averna-neon">
                <Target className="h-3.5 w-3.5" /> {goal}
              </span>
            )}
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2.5 mt-5">
          {pills.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.label}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.bg} ${p.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className={`text-base font-bold ${p.color}`}>
                    {p.value === null ? "—" : (
                      <CountUp value={p.value} prefix={p.prefix ?? ""} suffix={p.suffix ?? ""} />
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400">{p.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily quote */}
        <div className="mt-5 flex items-start gap-2.5 border-t border-white/10 pt-4">
          <Quote className="h-5 w-5 text-averna-cyan shrink-0 mt-0.5" />
          <p className="text-sm text-gray-200 italic">
            &ldquo;{displayQuote.text}&rdquo; <span className="text-gray-400 not-italic">— {displayQuote.author}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
