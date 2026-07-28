"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A compact, consistent sort switcher for the admin panels.
 *
 * Writes the chosen key to the `sort` query parameter and lets the server
 * component re-order the data — so sorting survives a refresh, is shareable as a
 * URL, and needs no client-side data handling. Other query params (filters,
 * flash messages) are preserved. One control, reused across panels, is what makes
 * the admin area feel ordered instead of ad-hoc.
 */
export function SortControl({
  options,
  paramKey = "sort",
  label = "Saralash",
}: {
  options: { value: string; label: string }[];
  paramKey?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? options[0]?.value;

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === options[0]?.value) next.delete(paramKey);
    else next.set(paramKey, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-gray-500 shrink-0">
        <ArrowUpDown className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => select(o.value)}
              aria-pressed={active}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                active ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
