"use client";

import { useCallback, useEffect, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sun, GraduationCap, TrendingUp, Users, Gamepad2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_TAB_KEYS,
  dashboardTabHref,
  isDashboardTab,
  parseDashboardTab,
  type DashboardTabKey,
} from "@/lib/dashboard/tabs";

const TAB_META: Record<DashboardTabKey, { label: string; icon: LucideIcon; active: string }> = {
  home: { label: "Today", icon: Sun, active: "bg-averna-neon/15 text-averna-neon ring-1 ring-averna-neon/40" },
  learn: { label: "Learn", icon: GraduationCap, active: "bg-averna-purple/15 text-averna-purple ring-1 ring-averna-purple/40" },
  progress: { label: "Progress", icon: TrendingUp, active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
  class: { label: "Class", icon: Users, active: "bg-averna-blue/15 text-averna-blue ring-1 ring-averna-blue/40" },
  fun: { label: "Play", icon: Gamepad2, active: "bg-averna-pink/15 text-averna-pink ring-1 ring-averna-pink/40" },
};

const TABS = DASHBOARD_TAB_KEYS.map((key) => ({ key, ...TAB_META[key] }));

/**
 * Tab bar of the student dashboard (rendered by app/dashboard/layout.tsx). The
 * active tab is the URL's `?tab=` param: a tab is a real link, switching pushes
 * the new URL in a transition (the old tab stays dimmed until the server has
 * rendered the new one), and Back / Forward / reload keep the student's place.
 * The bar is sticky, colour-coded per section, finger-friendly and scrolls on
 * phones.
 */
export function DashboardTabs({ children }: { children: ReactNode }) {
  const router = useRouter();
  const active = parseDashboardTab(useSearchParams().get("tab"));
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<DashboardTabKey | null>(null);
  const highlighted = isPending && pendingKey ? pendingKey : active;

  const go = useCallback(
    (key: DashboardTabKey) => {
      if (key === active && !isPending) return;
      setPendingKey(key);
      startTransition(() => router.push(dashboardTabHref(key), { scroll: false }));
      if (typeof window !== "undefined" && window.scrollY > 200) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [active, isPending, router]
  );

  const onClick = (e: MouseEvent<HTMLAnchorElement>, key: DashboardTabKey) => {
    // New tab / window, download etc.: let the browser handle the real link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(key);
  };

  // Focus mode hides the gamified "Play" tab, so never stay on it then.
  useEffect(() => {
    if (active === "fun" && document.body.classList.contains("focus-mode")) {
      router.replace("/dashboard", { scroll: false });
    }
  }, [active, router]);

  // Allow other dashboard widgets to jump to a tab (e.g. Mood recommendation).
  useEffect(() => {
    const onGoto = (e: Event) => {
      const key = (e as CustomEvent).detail;
      if (isDashboardTab(key)) go(key);
    };
    window.addEventListener("averna-goto-tab", onGoto);
    return () => window.removeEventListener("averna-goto-tab", onGoto);
  }, [go]);

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-[var(--app-bar-h,0px)] z-30 -mx-4 px-4 py-2 mb-4">
        <div className="no-scrollbar overflow-x-auto">
          <nav
            aria-label="Dashboard sections"
            className="flex w-max min-w-full md:min-w-0 gap-1 md:mx-auto glass-strong border border-white/10 rounded-2xl p-1.5 shadow-xl"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = highlighted === t.key;
              return (
                <Link
                  key={t.key}
                  href={dashboardTabHref(t.key)}
                  scroll={false}
                  prefetch={false}
                  onClick={(e) => onClick(e, t.key)}
                  {...(t.key === "fun" ? { "data-gamified": "" } : {})}
                  className={`flex flex-1 md:flex-none flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[44px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    isActive ? `${t.active} shadow-lg` : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Active tab content (staggered fade-in; dimmed while the next tab loads) */}
      <section
        key={active}
        aria-label={TAB_META[active].label}
        aria-busy={isPending || undefined}
        className={cn("tab-stagger space-y-6 transition-opacity duration-200", isPending && "opacity-60")}
      >
        {children}
      </section>
    </div>
  );
}
