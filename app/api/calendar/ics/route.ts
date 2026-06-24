import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSchedule } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function icsDate(d: Date) {
  // All-day date value: YYYYMMDD
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function icsStamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function esc(s: string) {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/**
 * Generates an .ics calendar feed for the logged-in student containing their
 * homework deadlines (all-day events) and weekly lessons (recurring), so they
 * can subscribe in Google/Apple Calendar.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { group: true },
  });
  if (!student) return new NextResponse("No student profile", { status: 404 });

  const now = new Date();
  const homework = student.groupId
    ? await db.homework.findMany({
        where: { groupId: student.groupId, dueDate: { gte: new Date(now.getTime() - 30 * 86400000) } },
        select: { id: true, title: true, dueDate: true },
      })
    : [];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Averna Learning Centre//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Averna — My Schedule",
  ];

  const stamp = icsStamp(now);

  // Homework deadlines as all-day events
  for (const hw of homework) {
    const d = new Date(hw.dueDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:hw-${hw.id}@averna`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(d)}`,
      `SUMMARY:${esc("📚 Homework due: " + hw.title)}`,
      "END:VEVENT"
    );
  }

  // Weekly lessons (recurring) from the group schedule string
  const { days, time } = parseSchedule(student.group?.schedule);
  if (days.length > 0) {
    const [hh, mm] = (time ?? "18:00").split(":").map((x) => parseInt(x, 10));
    // First upcoming occurrence
    const todayIdx = now.getDay();
    const offset = Math.min(...days.map((d) => (d - todayIdx + 7) % 7));
    const first = new Date(now);
    first.setDate(now.getDate() + offset);
    first.setHours(hh || 18, mm || 0, 0, 0);
    const local = `${first.getFullYear()}${pad(first.getMonth() + 1)}${pad(first.getDate())}T${pad(first.getHours())}${pad(first.getMinutes())}00`;
    const byday = days.map((d) => BYDAY[d]).join(",");
    lines.push(
      "BEGIN:VEVENT",
      `UID:lesson-${student.groupId}@averna`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local}`,
      "DURATION:PT1H30M",
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
      `SUMMARY:${esc("🎓 " + (student.group?.name ?? "Lesson"))}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="averna-schedule.ics"',
    },
  });
}
