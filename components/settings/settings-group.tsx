"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** sessionStorage key prefix: "open" / "closed" per group id, for this tab. */
export const SETTINGS_GROUP_KEY = "averna_settings_group:";
/** From here up every group starts open (the two-column desktop layout). */
const DESKTOP_QUERY = "(min-width: 1024px)";

const isDesktop = () => typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches;

function remembered(id: string): boolean | null {
  try {
    const v = sessionStorage.getItem(SETTINGS_GROUP_KEY + id);
    return v === "open" ? true : v === "closed" ? false : null;
  } catch {
    return null;
  }
}

function remember(id: string, open: boolean) {
  try {
    sessionStorage.setItem(SETTINGS_GROUP_KEY + id, open ? "open" : "closed");
  } catch {
    /* storage blocked: the group just doesn't remember */
  }
}

function hashTarget(): string {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

/**
 * One Settings group as a disclosure card: a ≥ 44 px header button (inside an
 * <h2> whose name is just the title) with aria-expanded / aria-controls, and the
 * group's rows below it. Collapsed, the header's second line is a one-line
 * summary of the current values ("Dark · Medium text"); open, it is the
 * subtitle. The full line is the button's accessible description, so the
 * visual truncation loses nothing.
 *
 * Starts open on desktop (≥ lg) and, on phones, only when `phoneOpen`; the
 * choice is remembered per group in sessionStorage. A URL hash naming the
 * group, or an element inside it (/settings#reading-comfort, #offline), opens
 * it and scrolls to it, on load and on hashchange. Before hydration the
 * breakpoint default is pure CSS, so the server HTML fits both layouts.
 * Collapsed rows stay mounted (hidden), so their state and data survive.
 */
export function SettingsGroup({
  id, icon, title, subtitle, summary, accent, phoneOpen = false, children,
}: {
  /** The section's id: the hash that opens it (kebab-case). */
  id: string;
  icon: ReactNode;
  title: string;
  /** Second line while open (defaults to the summary). */
  subtitle?: string;
  /** Second line while collapsed: the current values. */
  summary: string;
  accent: string;
  /** Open by default on phones too (only Display). */
  phoneOpen?: boolean;
  children: ReactNode;
}) {
  // null until mounted: the breakpoint default, done in CSS.
  const [open, setOpen] = useState<boolean | null>(null);
  const [reveal, setReveal] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const expanded = open ?? phoneOpen;
  const titleId = `${id}-title`;
  const lineId = `${id}-line`;
  const panelId = `${id}-panel`;

  useEffect(() => {
    setOpen(remembered(id) ?? (isDesktop() || phoneOpen));
  }, [id, phoneOpen]);

  // #<group id> or #<id inside the group>: open it and bring it into view.
  useEffect(() => {
    const onHash = () => {
      const target = hashTarget();
      const el = target ? document.getElementById(target) : null;
      if (!el || !sectionRef.current?.contains(el)) return;
      setOpen(true);
      setReveal((n) => n + 1);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (reveal && typeof sectionRef.current?.scrollIntoView === "function") sectionRef.current.scrollIntoView({ block: "start" });
  }, [reveal]);

  const toggle = () => {
    const next = !expanded;
    setOpen(next);
    remember(id, next);
  };

  return (
    <section
      ref={sectionRef}
      id={id}
      className="glass scroll-mt-[calc(var(--app-bar-h,0px)+0.75rem)] overflow-hidden rounded-2xl border border-white/5"
    >
      <h2 aria-labelledby={titleId}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-labelledby={titleId}
          aria-describedby={lineId}
          onClick={toggle}
          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-averna-neon/60 sm:px-4"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-white/15 to-white/[0.03] [&_svg]:h-[18px] [&_svg]:w-[18px]",
              accent
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span id={titleId} className="block text-[15px] font-bold leading-5 tracking-tight text-white">
              {title}
            </span>
            <span id={lineId} className="block truncate text-xs leading-4 text-gray-400">
              {expanded ? (subtitle ?? summary) : summary}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className={cn("h-5 w-5 shrink-0 text-gray-400 transition-transform", expanded && "rotate-180")} />
        </button>
      </h2>
      <div
        id={panelId}
        hidden={open === false}
        className={cn("divide-y divide-white/5 border-t border-white/5", open === null && !phoneOpen && "max-lg:hidden")}
      >
        {children}
      </div>
    </section>
  );
}
