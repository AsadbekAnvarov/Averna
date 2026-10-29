"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ChevronDown, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = { label: string; items: { name: string; href: string; icon: LucideIcon; badge?: string }[] };

/** One compact directory for the desktop rail and mobile drawer. Search never navigates. */
export function StudentSidebarSections({ sections, current }: { sections: Section[]; current: string | null }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map((s, i) => [s.label, i < 2 || s.items.some(item => item.href === current)])));
  useEffect(() => {
    const active = sections.find(s => s.items.some(item => item.href === current));
    if (active) setOpen(previous => ({ ...previous, [active.label]: true }));
    setQuery("");
  }, [current, sections]);
  const term = query.trim().toLowerCase();
  const filtered = sections.map(s => ({ ...s, items: s.items.filter(item => !term || `${s.label} ${item.name}`.toLowerCase().includes(term)) })).filter(s => s.items.length);

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 px-3 pb-2 pt-3">
      <label htmlFor={`${id}-search`} className="sr-only">Find a page</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
        <input id={`${id}-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a page…" autoComplete="off"
          className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-10 text-sm text-white outline-none placeholder:text-gray-400 focus:border-averna-neon/50 focus:ring-2 focus:ring-averna-neon/15 [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" aria-label="Clear navigation search" onClick={() => setQuery("")} className="absolute right-0 top-0 grid h-11 w-10 place-items-center rounded-xl text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>
    </div>
    <nav aria-label="Student directory" className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {filtered.map(section => {
        const index = sections.findIndex(s => s.label === section.label), expanded = !!term || !!open[section.label];
        const active = section.items.some(item => item.href === current);
        return <div key={section.label} className="border-b border-white/[0.06] pb-1 last:border-0">
          <button type="button" aria-expanded={expanded} aria-controls={`${id}-group-${index}`}
            onClick={() => setOpen(previous => ({ ...previous, [section.label]: !expanded }))}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/50">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-averna-neon" : "bg-gray-600")} aria-hidden />
            <span className="flex-1">{section.label}</span>
            <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none", !expanded && "-rotate-90")} />
          </button>
          <div id={`${id}-group-${index}`} hidden={!expanded} className="space-y-1 pb-2">
            {section.items.map(item => { const Icon=item.icon, selected=item.href===current; return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined}
              className={cn("group flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/50", selected ? "border-averna-neon/20 bg-averna-neon/10 text-white" : "border-transparent text-gray-400 hover:bg-white/[0.05] hover:text-white")}>
              <Icon aria-hidden className={cn("h-[18px] w-[18px] shrink-0", selected ? "text-averna-neon" : "text-gray-500 group-hover:text-gray-300")} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
            </Link>; })}
          </div>
        </div>;
      })}
      {!filtered.length && <p role="status" className="px-3 py-5 text-sm leading-relaxed text-gray-400">No pages found. Try a skill or category name.</p>}
    </nav>
  </div>;
}
