import Link from "next/link";
import { Brain, Flame, Award, Trophy, ArrowRight } from "lucide-react";

const LINKS = [
  { href: "/progress/skills", label: "Skills deep-dive", desc: "Predicted bands, memory, writing growth", icon: Brain, tone: "bg-averna-purple/15 text-averna-purple" },
  { href: "/progress/streaks", label: "Streaks & journal", desc: "Heatmap, study challenge, monthly recap", icon: Flame, tone: "bg-orange-400/15 text-orange-400" },
  { href: "/progress/achievements", label: "Achievements", desc: "Milestones, badges, certificate", icon: Award, tone: "bg-amber-400/15 text-amber-400" },
  { href: "/rankings", label: "Rankings", desc: "Leaderboard, leagues, team race", icon: Trophy, tone: "bg-averna-cyan/15 text-averna-cyan" },
];

/** "Go deeper" row at the end of the dashboard's Progress tab. */
export function ProgressLinks() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {LINKS.map(({ href, label, desc, icon: Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className="group glass flex items-center gap-3 rounded-2xl border border-white/10 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
        >
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{label}</p>
            <p className="truncate text-xs text-gray-400">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      ))}
    </div>
  );
}
