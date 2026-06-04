"use client";

import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";

interface Props {
  title: string;
  details?: string;
  /** weekday names found in the group's schedule text, e.g. ["Mon","Wed"] */
  scheduleText?: string | null;
}

const DAY_TO_NUM: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function nextDateForSchedule(scheduleText?: string | null): Date {
  // Find the next upcoming weekday mentioned in the schedule text.
  const now = new Date();
  if (scheduleText) {
    const t = scheduleText.toLowerCase();
    const targets = Object.entries(DAY_TO_NUM)
      .filter(([abbr]) => t.includes(abbr))
      .map(([, n]) => n);
    if (targets.length > 0) {
      for (let add = 0; add < 8; add++) {
        const d = new Date(now);
        d.setDate(now.getDate() + add);
        if (targets.includes(d.getDay())) {
          d.setHours(18, 0, 0, 0);
          return d;
        }
      }
    }
  }
  const d = new Date(now);
  d.setDate(now.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function fmt(d: Date): string {
  // Google Calendar format: YYYYMMDDTHHMMSS
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function AddToGoogleCalendar({ title, details, scheduleText }: Props) {
  const start = nextDateForSchedule(scheduleText);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2-hour lesson

  const url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent(details ?? "Averna Learning Centre lesson")}` +
    "&recur=RRULE:FREQ=WEEKLY";

  return (
    <a href={url} target="_blank" rel="noreferrer">
      <Button variant="outline" size="sm" className="border-averna-cyan/40 text-averna-cyan">
        <CalendarPlus className="mr-2 h-4 w-4" /> Add to Google Calendar
      </Button>
    </a>
  );
}
