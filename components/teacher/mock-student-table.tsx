"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  SECTIONS,
  SECTION_LABEL,
  defaultDir,
  formatBand,
  formatDelta,
  mockResultHref,
  sectionResultHref,
  sortStudentRows,
  type SortDir,
  type StudentMockRow,
  type StudentSortKey,
} from "@/lib/teacher/mock-analytics-core";

/**
 * Every student of the selected group(s) with their mocks — sortable by any
 * column (click a header; again to reverse). Students without a mock always
 * sink to the bottom. The latest date and the best band open that mock's
 * result; a section band opens the section's own result page.
 */

type Column = { key: StudentSortKey; label: string; numeric: boolean };

const TEXT_SORT: Partial<Record<StudentSortKey, true>> = { name: true, group: true };

function describeSort(label: string, key: StudentSortKey, dir: SortDir): string {
  if (TEXT_SORT[key]) return `Sorted by ${label}, ${dir === "asc" ? "A to Z" : "Z to A"}`;
  if (key === "date") return `Sorted by ${label}, ${dir === "desc" ? "newest first" : "oldest first"}`;
  return `Sorted by ${label}, ${dir === "desc" ? "highest first" : "lowest first"}`;
}

function daysAgo(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function deltaTone(d: number | null): string {
  if (d === null) return "text-gray-500";
  if (d >= 0) return "text-averna-neon";
  if (d >= -0.5) return "text-amber-300";
  return "text-averna-pink";
}

const LINK = "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

export function MockStudentTable({
  rows,
  showGroup,
  caption,
}: {
  rows: StudentMockRow[];
  showGroup: boolean;
  caption: string;
}) {
  const [sort, setSort] = useState<{ key: StudentSortKey; dir: SortDir }>({ key: "overall", dir: "desc" });
  const sorted: StudentMockRow[] = useMemo(() => sortStudentRows(rows, sort.key, sort.dir), [rows, sort]);

  const columns: Column[] = [
    { key: "name", label: "Student", numeric: false },
    ...(showGroup ? [{ key: "group" as const, label: "Group", numeric: false }] : []),
    { key: "date", label: "Latest mock", numeric: false },
    { key: "overall", label: "Overall", numeric: true },
    ...SECTIONS.map((s) => ({ key: s, label: SECTION_LABEL[s], numeric: true })),
    { key: "best", label: "Best", numeric: true },
    { key: "vsTarget", label: "vs target", numeric: true },
    { key: "count", label: "Mocks", numeric: true },
  ];
  const active = columns.find((c) => c.key === sort.key) ?? columns[0];
  const sortText = describeSort(active.label, sort.key, sort.dir);

  const choose = (key: StudentSortKey) =>
    setSort((s: { key: StudentSortKey; dir: SortDir }) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }
    );

  return (
    <div className="glass overflow-hidden rounded-2xl border border-white/10">
      <p className="sr-only" aria-live="polite">
        {sortText}
      </p>
      <div className="overflow-x-auto" role="region" aria-label="Students and their mock results" tabIndex={0}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">
            {caption}. {sortText}.
          </caption>
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              {columns.map((c) => {
                const on = c.key === sort.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "px-3 py-2.5 font-semibold",
                      c.numeric && "text-right",
                      c.key === "name" && "sticky left-0 z-10 bg-averna-dark/80 backdrop-blur"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => choose(c.key)}
                      className={cn(
                        "inline-flex min-h-[36px] items-center gap-1 rounded-md px-1 uppercase tracking-wider hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
                        on ? "text-white" : "text-gray-400",
                        c.numeric && "flex-row-reverse"
                      )}
                    >
                      {c.label}
                      {on ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((r) => (
              <StudentRow key={r.studentId} r={r} showGroup={showGroup} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentRow({ r, showGroup }: { r: StudentMockRow; showGroup: boolean }) {
  const latest = r.latest;
  const change = formatDelta(r.change);
  const vs = formatDelta(r.vsTarget);
  return (
    <tr className="align-top transition-colors hover:bg-white/[0.03]">
      {/* Sticky, so the name stays in view while the bands scroll on a phone. */}
      <th scope="row" className="sticky left-0 z-10 bg-averna-dark/80 px-3 py-3 text-left font-normal backdrop-blur">
        <p className="font-medium text-white">{r.name}</p>
        {r.active && !r.active.stalled ? (
          <p className="text-xs text-amber-300">
            Sitting a mock · {r.active.section ? SECTION_LABEL[r.active.section] : "finishing"}
          </p>
        ) : !latest ? (
          <p className="text-xs text-gray-500">No mock yet</p>
        ) : null}
      </th>
      {showGroup && <td className="px-3 py-3 text-xs text-gray-300">{r.groupName ?? "—"}</td>}
      <td className="px-3 py-3 text-xs">
        {latest ? (
          <>
            <Link href={mockResultHref(latest.attemptId)} className={cn(LINK, "font-medium text-gray-100 hover:text-averna-neon hover:underline")}>
              <time dateTime={latest.finishedAt}>{formatDate(latest.finishedAt)}</time>
              <span className="sr-only"> — open {r.name}&apos;s mock result</span>
            </Link>
            <p className="text-gray-500">{daysAgo(r.daysSince)}</p>
          </>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <p className="text-base font-bold text-white">{formatBand(latest?.overall)}</p>
        {change && (
          <p className={cn("text-xs", r.change! > 0 ? "text-averna-neon" : r.change! < 0 ? "text-averna-pink" : "text-gray-500")}>
            {change}
            <span className="sr-only"> since the previous mock</span>
          </p>
        )}
      </td>
      {SECTIONS.map((s) => {
        const band = latest?.bands[s] ?? null;
        const test = latest?.tests[s] ?? null;
        const blank = !!latest?.blank[s];
        return (
          <td key={s} className="px-3 py-3 text-right tabular-nums">
            {band === null ? (
              <span className="text-gray-600">—</span>
            ) : test ? (
              <Link
                href={sectionResultHref(s, test)}
                className={cn(LINK, "font-semibold text-gray-100 hover:text-averna-neon hover:underline")}
              >
                {formatBand(band)}
                <span className="sr-only"> — open {r.name}&apos;s {SECTION_LABEL[s]} section</span>
              </Link>
            ) : (
              <span className="font-semibold text-gray-300">{formatBand(band)}</span>
            )}
            {blank && <p className="text-[11px] text-gray-500">blank</p>}
          </td>
        );
      })}
      <td className="px-3 py-3 text-right tabular-nums">
        {r.best?.attemptId ? (
          <Link href={mockResultHref(r.best.attemptId)} className={cn(LINK, "font-semibold text-gray-100 hover:text-averna-neon hover:underline")}>
            {formatBand(r.best.overall)}
            <span className="sr-only"> — open {r.name}&apos;s best mock</span>
          </Link>
        ) : r.best ? (
          <span className="font-semibold text-gray-300">{formatBand(r.best.overall)}</span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {vs ? <p className={cn("font-semibold", deltaTone(r.vsTarget))}>{vs}</p> : <span className="text-gray-600">—</span>}
        {r.target !== null && <p className="text-[11px] text-gray-500">target {formatBand(r.target)}</p>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-gray-200">{r.count}</td>
    </tr>
  );
}
