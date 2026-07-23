"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Home, GraduationCap, TrendingUp, Users, Sparkles } from "lucide-react";

const TABS = [
  { key: "home", label: "Home", icon: Home, active: "bg-averna-neon/15 text-averna-neon ring-1 ring-averna-neon/40" },
  { key: "learn", label: "Learn", icon: GraduationCap, active: "bg-averna-purple/15 text-averna-purple ring-1 ring-averna-purple/40" },
  { key: "progress", label: "Progress", icon: TrendingUp, active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
  { key: "class", label: "Class", icon: Users, active: "bg-averna-blue/15 text-averna-blue ring-1 ring-averna-blue/40" },
  { key: "fun", label: "Rewards", icon: Sparkles, active: "bg-averna-pink/15 text-averna-pink ring-1 ring-averna-pink/40" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Tabbed shell for the student dashboard. Each tab's content is pre-rendered on
 * the server and passed as a prop, so switching is instant. The tab bar is
 * sticky, colour-coded per section, finger-friendly and scrolls on phones.
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

  // Allow other dashboard widgets to jump to a tab (e.g. Mood recommendation).
  useEffect(() => {
    const onGoto = (e: Event) => {
      const key = (e as CustomEvent).detail as TabKey;
      if (key && TABS.some((t) => t.key === key)) {
        setActive(key);
        localStorage.setItem("averna_dash_tab", key);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("averna-goto-tab", onGoto as EventListener);
    return () => window.removeEventListener("averna-goto-tab", onGoto as EventListener);
  }, []);

  const content: Record<TabKey, ReactNode> = { home, learn, progress, class: classroom, fun };

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 mb-4">
        <div className="flex overflow-x-auto md:justify-center">
          <div className="flex gap-1 mx-auto md:mx-0 glass-strong border border-white/10 rounded-2xl p-1.5 shadow-xl">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => select(t.key)}
                  className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    isActive ? `${t.active} shadow-lg` : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={`h-5 w-5 shrink-0 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active tab content (staggered fade-in) */}
      <div key={active} className="tab-stagger space-y-6">
        {content[active]}
      </div>
    </div>
  );
}
