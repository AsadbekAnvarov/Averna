"use client";

import { useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { daysInMonthOf, parseSelectedDay, type DayItem, type DayItemKind } from "@/lib/calendar-days";

/** Same colours as the calendar legend (Lesson / 1-on-1 tutoring / Homework due). */
const KIND_DOT: Record<DayItemKind, string> = {
  lesson: "bg-averna-primary/40",
  tutoring: "bg-averna-pink/30",
  homework: "bg-averna-purple/30",
};

const KIND_NAME: Record<DayItemKind, string> = {
  lesson: "Lesson",
  tutoring: "1-on-1 tutoring",
  homework: "Homework due",
};

const KIND_ORDER: DayItemKind[] = ["lesson", "tutoring", "homework"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Phone month view (< sm) of the student and teacher calendars. The sm+ grid with text
 * labels stays as it is; here every day is a ≥44 px link to `?m=YYYY-M&d=D` with coloured
 * dots, and the selected day's full list sits under the grid.
 */
export function PhoneMonth({
  basePath,
  year,
  month,
  todayDay,
  selectedDay,
  items,
}: {
  /** Page path without a query, e.g. "/calendar". */
  basePath: string;
  year: number;
  /** 0-based month. */
  month: number;
  /** Today's day of this month, or -1 for another month. */
  todayDay: number;
  selectedDay: number;
  items: Record<number, DayItem[]>;
}) {
  const searchParams = useSearchParams();
  const daysInMonth = daysInMonthOf(year, month);
  // All of this month's items are already present. Day selection is local URL
  // state, not another server navigation; reload / Back / Forward retain it.
  const activeDay = parseSelectedDay(searchParams.get("d") ?? String(selectedDay), daysInMonth, todayDay);
  const selectDay = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href");
    if (href && window.location.pathname === basePath && window.location.search !== new URL(href, window.location.origin).search) {
      window.history.pushState(null, "", href);
    }
  };
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateLabel = (day: number, weekday: boolean) =>
    new Date(year, month, day).toLocaleDateString("en-US", {
      weekday: weekday ? "long" : undefined,
      month: "long",
      day: "numeric",
    });
  const selected = items[activeDay] ?? [];

  return (
    <div className="sm:hidden">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const dayItems = items[day] ?? [];
          const kinds = KIND_ORDER.filter((k) => dayItems.some((it) => it.kind === k));
          const isSelected = day === activeDay;
          const isToday = day === todayDay;
          return (
            <a
              key={day}
              href={`${basePath}?m=${year}-${month + 1}&d=${day}`}
              onClick={selectDay}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${dateLabel(day, false)}${dayItems.length ? `, ${dayItems.length} scheduled` : ""}`}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan",
                isSelected
                  ? "border-averna-cyan bg-averna-cyan/15 text-white"
                  : isToday
                    ? "border-averna-neon bg-averna-neon/10 text-averna-neon"
                    : "border-white/10 bg-white/5 text-gray-300 hover:border-averna-cyan/40"
              )}
            >
              <span>{day}</span>
              <span className="flex h-2 items-center gap-0.5" aria-hidden="true">
                {kinds.map((k) => (
                  <span key={k} className={cn("h-2 w-2 rounded-full", KIND_DOT[k])} />
                ))}
              </span>
            </a>
          );
        })}
      </div>

      <section aria-label="Selected day" className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <h4 className="text-sm font-semibold text-white">{dateLabel(activeDay, true)}</h4>
        {selected.length ? (
          <ul className="mt-2 space-y-2">
            {selected.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", KIND_DOT[it.kind])} aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="text-gray-400">{KIND_NAME[it.kind]}</span>
                  {it.label && <span className="text-white"> · {it.label}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-400">Nothing scheduled</p>
        )}
      </section>
    </div>
  );
}
