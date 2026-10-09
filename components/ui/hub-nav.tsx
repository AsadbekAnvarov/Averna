"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Brain, Flame, Award, Trophy, Crown, Swords, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HubItem = { href: string; label: string; icon: LucideIcon; active: string };

/**
 * Section tabs for the student "hub" pages. Each tab is a real route (so only
 * the open tab's data is fetched and every tab has its own URL); the bar is
 * sticky under the mobile top bar and scrolls sideways on narrow phones.
 */
const HUBS = {
  progress: [
    { href: "/progress", label: "Overview", icon: LayoutDashboard, active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
    { href: "/progress/skills", label: "Skills", icon: Brain, active: "bg-averna-purple/15 text-averna-purple ring-1 ring-averna-purple/40" },
    { href: "/progress/streaks", label: "Streaks", icon: Flame, active: "bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/40" },
    { href: "/progress/achievements", label: "Achievements", icon: Award, active: "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40" },
  ],
  rankings: [
    { href: "/rankings", label: "Leaderboard", icon: Trophy, active: "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40" },
    { href: "/rankings/leagues", label: "Leagues", icon: Crown, active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
    { href: "/rankings/teams", label: "Teams", icon: Swords, active: "bg-averna-pink/15 text-averna-pink ring-1 ring-averna-pink/40" },
  ],
} satisfies Record<string, HubItem[]>;

export type HubKey = keyof typeof HUBS;

export function HubNav({ hub, label }: { hub: HubKey; label: string }) {
  const pathname = usePathname() || "";
  const items: HubItem[] = HUBS[hub];
  // The longest matching href wins, so /progress doesn't also light up on /progress/skills.
  const current = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label={label} className="sticky top-[var(--app-bar-h,0px)] z-30 -mx-4 mb-6 px-4 py-2">
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex w-max min-w-full gap-1 rounded-2xl border border-white/10 p-1.5 shadow-xl glass-strong md:min-w-0">
          {items.map((t) => {
            const Icon = t.icon;
            const active = t.href === current;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-2 text-sm font-semibold transition-all duration-300 sm:flex-row sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm md:flex-none",
                  active ? cn(t.active, "shadow-lg") : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
