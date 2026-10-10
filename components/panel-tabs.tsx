"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
  aliases,
  wrapOnMobile = false,
}: {
  tabs: PanelTab[];
  content: Record<string, ReactNode>;
  storageKey: string;
  aliases?: Record<string, string>;
  wrapOnMobile?: boolean;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const searchParams = useSearchParams();
  const restored = useRef(false);

  useEffect(() => {
    // Deep link: `?tab=<key>#anchor` selects that tab (and scrolls to the
    // anchor), taking precedence over the remembered tab. Driven by
    // useSearchParams so it also fires on SAME-PAGE navigation — this is what
    // makes the attention-bar pill and AI action links (?tab=people#enroll)
    // work even when clicked from another tab on the very same page.
    const requestedTab = searchParams.get("tab");
    const tabParam = requestedTab ? aliases?.[requestedTab] ?? requestedTab : null;
    if (tabParam && tabs.some((t) => t.key === tabParam)) {
      setActive(tabParam);
      sessionStorage.setItem(storageKey, tabParam);
      restored.current = true;
      const hash = window.location.hash;
      if (hash.length > 1) {
        setTimeout(() => {
          document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
      return;
    }
    // Session-scoped memory (only on first mount): keeps the tab during the
    // current visit, but leaving the site and returning later starts fresh on
    // the first tab (overview).
    if (!restored.current) {
      restored.current = true;
      const requestedSaved = sessionStorage.getItem(storageKey);
      const saved = requestedSaved ? aliases?.[requestedSaved] ?? requestedSaved : null;
      if (saved && tabs.some((t) => t.key === saved)) {
        setActive(saved);
        if (saved !== requestedSaved) sessionStorage.setItem(storageKey, saved);
      }
    }
  }, [searchParams, storageKey, tabs, aliases]);

  const select = (k: string) => {
    setActive(k);
    sessionStorage.setItem(storageKey, k);
    if (typeof window !== "undefined" && window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div>
      <div className={`${wrapOnMobile?"relative sm:sticky sm:top-[var(--app-bar-h,0px)]":"sticky top-[var(--app-bar-h,0px)]"} z-30 -mx-4 px-4 py-2 mb-4`}>
        <div className="no-scrollbar overflow-x-auto">
          <div className={`${wrapOnMobile?"grid grid-cols-2 sm:flex w-full sm:w-max":"flex w-max"} min-w-full md:min-w-0 gap-1 md:mx-auto glass-strong border border-white/10 rounded-2xl p-1.5 shadow-xl`}>
            {tabs.map((t) => {
              const Icon = ICONS[t.icon] ?? LayoutDashboard;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => select(t.key)}
                  className={`flex flex-1 md:flex-none ${wrapOnMobile?"flex-row min-h-11 text-sm whitespace-normal sm:whitespace-nowrap":"flex-col sm:flex-row min-h-11 text-sm whitespace-nowrap"} items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold transition-all duration-300 ${
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
