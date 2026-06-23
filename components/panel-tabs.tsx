"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, GraduationCap, TrendingUp, Users, BarChart3,
  ShieldCheck, Activity, Wallet,
} from "lucide-react";

const ICONS: Record<string, any> = {
  overview: LayoutDashboard,
  teaching: GraduationCap,
  insights: TrendingUp,
  people: Users,
  analytics: BarChart3,
  manage: ShieldCheck,
  activity: Activity,
  finance: Wallet,
};

export interface PanelTab {
  key: string;
  label: string;
  icon: string;
  active: string;
}

/**
 * Reusable tabbed shell for the teacher & admin panels. Tab content is
 * pre-rendered on the server and passed via `content`, so switching is instant.
 * Sticky, colour-coded, finger-friendly and responsive.
 */
export function PanelTabs({
  tabs,
  content,
  storageKey,
}: {
  tabs: PanelTab[];
  content: Record<string, ReactNode>;
  storageKey: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
  }, [storageKey, tabs]);

  const select = (k: string) => {
    setActive(k);
    localStorage.setItem(storageKey, k);
    if (typeof window !== "undefined" && window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 mb-4">
        <div className="flex overflow-x-auto md:justify-center">
          <div className="flex gap-1 mx-auto md:mx-0 glass-strong border border-white/10 rounded-2xl p-1.5 shadow-xl">
            {tabs.map((t) => {
              const Icon = ICONS[t.icon] ?? LayoutDashboard;
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

      <div key={active} className="tab-stagger space-y-6">
        {content[active]}
      </div>
    </div>
  );
}
