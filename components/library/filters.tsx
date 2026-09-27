import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ExamDifficulty, ExamTestSummary } from "@/lib/ielts/types";

/**
 * Library filters live in the URL (?type=…&difficulty=…) and render as plain
 * links, so they work without JavaScript, can be shared and survive reloads.
 */

export type ExamTypeFilter = "all" | "full" | "practice";
export type SearchParams = Record<string, string | string[] | undefined>;

export const DIFFICULTIES: ExamDifficulty[] = ["Easy", "Medium", "Hard"];

export const TYPE_LABEL: Record<ExamTypeFilter, string> = {
  all: "All",
  full: "Full tests",
  practice: "Short practice",
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseTypeFilter(v: string | string[] | undefined): ExamTypeFilter {
  const s = first(v)?.toLowerCase();
  return s === "full" || s === "practice" ? s : "all";
}

/** "easy" / "Easy" → "Easy"; anything else → null (= any difficulty). */
export function parseDifficulty(v: string | string[] | undefined): ExamDifficulty | null {
  const s = first(v)?.trim().toLowerCase();
  return DIFFICULTIES.find((d) => d.toLowerCase() === s) ?? null;
}

export function matchesType(exam: Pick<ExamTestSummary, "full">, type: ExamTypeFilter): boolean {
  return type === "all" || (type === "full" ? exam.full : !exam.full);
}

/** Path + query string from the given params; empty / null values are dropped. */
export function hrefWith(pathname: string, params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${pathname}?${s}` : pathname;
}

export interface FilterOption {
  key: string;
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/** A labelled row of filter links (≥44px targets; wraps instead of scrolling). */
export function FilterRow({ label, options, className }: { label: string; options: FilterOption[]; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="w-full text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 sm:w-auto sm:min-w-[5.5rem]">
        {label}
      </span>
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          scroll={false}
          aria-current={o.active ? "true" : undefined}
          className={cn(
            "glow-hover inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors",
            o.active
              ? "border-averna-neon/40 bg-averna-neon/10 text-averna-neon"
              : "border-white/10 bg-white/5 text-gray-300 hover:text-white"
          )}
        >
          {o.label}
          {o.count != null && (
            <span className="rounded-md bg-white/10 px-1.5 text-[11px] tabular-nums text-gray-400">
              <span className="sr-only">(</span>
              {o.count}
              <span className="sr-only"> tests)</span>
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
