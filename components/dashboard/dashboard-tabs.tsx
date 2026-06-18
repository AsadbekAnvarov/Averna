"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Home, GraduationCap, TrendingUp, Users, Gamepad2 } from "lucide-react";

const TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "learn", label: "Learn", icon: GraduationCap },
  { key: "progress", label: "Progress", icon: TrendingUp },
  { key: "class", label: "Class", icon: Users },
  { key: "fun", label: "Fun", icon: Gamepad2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Tabbed shell for the student dashboard. Each tab's content is pre-rendered on
 * the server and passed in as a prop, so switching is instant (no refetch).
 * The tab bar is sticky, finger-friendly and scrolls horizontally on phones.
 */
export function DashboardTabs({
  home,
  learn,
  progress,
  classroom,
  fun,
}: {
  home: ReactNode;
  learn: ReactNode;
  progress: ReactNode;
  classroom: ReactNode;
  fun: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("home");

  useEffect(() => {
    const saved = localStorage.getItem("averna_dash_tab") as TabKey | null;
    if (saved && TABS.some((t) => t.key === saved)) setActive(saved);
  }, []);

  const select = (k: TabKey) => {
    setActive(k);
    localStorage.setItem("averna_dash_tab", k);
    if (typeof window !== "undefined" && window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const content: Record<TabKey, ReactNode> = { home, learn, progress, class: classroom, fun };

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 mb-2">
        <div className="flex overflow-x-auto md:justify-center">
          <div className="flex gap-1 mx-auto md:mx-0 glass-strong border border-white/10 rounded-2xl p-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => select(t.key)}
                  className={`flex items-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-averna-primary text-white shadow-lg shadow-averna-primary/20"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active tab content */}
      <div key={active} className="animate-fade-in space-y-6">
        {content[active]}
      </div>
    </div>
  );
}
