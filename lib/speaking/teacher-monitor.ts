/**
 * Data for the teacher peer speaking monitor, /teacher/speaking (docs/peer-speaking.md,
 * Phase C). Teachers see sessions and open reports that involve a student of their
 * groups; admins see everything. Server only.
 */
import { db } from "@/lib/db";
import { tashkentWeekStart } from "@/lib/utils";
import { CRITERIA } from "./feedback-presets";
import { PAUSE_REPORTS, firstName } from "./peer-store";
import { isPeerSessionState } from "./session";
import { finishedNaturally } from "./session-view";
import { isReportReason, REPORT_REASON_LABEL } from "./safety";

export interface MonitorPerson {
  id: string;
  name: string;
  group: string | null;
}

export interface MonitorSession {
  id: string;
  at: number;
  a: MonitorPerson;
  b: MonitorPerson;
  format: string;
  minutes: number | null;
  outcome: "completed" | "ended-early" | "active";
  /** Mean of the four criteria A gave B, and B gave A (1–5), or null. */
  ratingAtoB: number | null;
  ratingBtoA: number | null;
}

export interface MonitorReport {
  id: string;
  at: number;
  roomId: string;
  reason: string;
  reasonLabel: string;
  note: string | null;
  reporter: MonitorPerson;
  reported: MonitorPerson;
  /** Open reports about the reported student (this one included). */
  openAboutReported: number;
  paused: boolean;
  /** Resolving this report drops the reported student below the pause threshold. */
  unpausesOnResolve: boolean;
}

export interface PeerMonitorData {
  sessions: MonitorSession[];
  reports: MonitorReport[];
  summary: { sessions: number; students: number; avgMinutes: number | null; paused: number };
}

const EMPTY: PeerMonitorData = { sessions: [], reports: [], summary: { sessions: 0, students: 0, avgMinutes: null, paused: 0 } };

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** `scope`: "all" for admins, else the ids of the teacher's students. */
export async function loadPeerMonitor(scope: "all" | string[], now = Date.now()): Promise<PeerMonitorData> {
  if (scope !== "all" && scope.length === 0) return EMPTY;
  const inScope = (id: string) => scope === "all" || scope.includes(id);
  const since = tashkentWeekStart(new Date(now));
  const ids = scope === "all" ? null : { in: scope };

  const [rooms, openReports] = await Promise.all([
    db.speakingRoom.findMany({
      where: { createdAt: { gte: since }, ...(ids ? { OR: [{ studentAId: ids }, { studentBId: ids }] } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        endedAt: true,
        format: true,
        status: true,
        state: true,
        studentAId: true,
        studentAName: true,
        studentBId: true,
        studentBName: true,
      },
    }),
    db.speakingReport.findMany({
      where: { status: "OPEN", ...(ids ? { OR: [{ reportedId: ids }, { reporterId: ids }] } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, createdAt: true, roomId: true, reason: true, note: true, reporterId: true, reportedId: true },
    }),
  ]);

  const roomIds = rooms.map((r) => r.id);
  const reportedIds = [...new Set(openReports.map((r) => r.reportedId))];
  const people = [...new Set([...rooms.flatMap((r) => [r.studentAId, r.studentBId]), ...openReports.flatMap((r) => [r.reporterId, r.reportedId])])];
  const [feedback, openCounts, students] = await Promise.all([
    roomIds.length
      ? db.speakingPeerFeedback.findMany({
          where: { roomId: { in: roomIds } },
          select: { roomId: true, fromStudentId: true, fluency: true, lexical: true, grammar: true, pronunciation: true },
        })
      : Promise.resolve([]),
    reportedIds.length
      ? db.speakingReport.findMany({ where: { status: "OPEN", reportedId: { in: reportedIds } }, select: { reportedId: true }, take: 2000 })
      : Promise.resolve([]),
    people.length
      ? db.student.findMany({ where: { id: { in: people } }, select: { id: true, user: { select: { name: true } }, group: { select: { name: true } } } })
      : Promise.resolve([]),
  ]);

  const studentById = new Map(students.map((s) => [s.id, s]));
  const person = (id: string, fallback?: string): MonitorPerson => {
    const s = studentById.get(id);
    return { id, name: s ? firstName(s.user?.name) : (fallback ?? "Student"), group: s?.group?.name ?? null };
  };
  const open = new Map<string, number>();
  for (const r of openCounts) open.set(r.reportedId, (open.get(r.reportedId) ?? 0) + 1);

  const sessions: MonitorSession[] = rooms.map((r) => {
    const state = isPeerSessionState(r.state) ? r.state : null;
    const given = (from: string) => {
      const f = feedback.find((x) => x.roomId === r.id && x.fromStudentId === from);
      return f ? round1(mean(CRITERIA.map((c) => f[c]))) : null;
    };
    return {
      id: r.id,
      at: r.createdAt.getTime(),
      a: person(r.studentAId, r.studentAName),
      b: person(r.studentBId, r.studentBName),
      format: r.format,
      minutes: r.endedAt ? Math.max(1, Math.round((r.endedAt.getTime() - r.createdAt.getTime()) / 60_000)) : null,
      outcome: r.status === "ACTIVE" ? "active" : finishedNaturally(state) ? "completed" : "ended-early",
      ratingAtoB: given(r.studentAId),
      ratingBtoA: given(r.studentBId),
    };
  });

  const reports: MonitorReport[] = openReports.map((r) => {
    const count = open.get(r.reportedId) ?? 1;
    const paused = count >= PAUSE_REPORTS;
    return {
      id: r.id,
      at: r.createdAt.getTime(),
      roomId: r.roomId,
      reason: r.reason,
      reasonLabel: isReportReason(r.reason) ? REPORT_REASON_LABEL[r.reason] : r.reason,
      note: r.note,
      reporter: person(r.reporterId),
      reported: person(r.reportedId),
      openAboutReported: count,
      paused,
      unpausesOnResolve: paused && count - 1 < PAUSE_REPORTS,
    };
  });

  const studentsThisWeek = new Set(rooms.flatMap((r) => [r.studentAId, r.studentBId]).filter(inScope));
  const paused = [...open.entries()].filter(([id, n]) => n >= PAUSE_REPORTS && inScope(id)).length;
  return {
    sessions,
    reports,
    summary: {
      sessions: sessions.length,
      students: studentsThisWeek.size,
      avgMinutes: round1(mean(sessions.filter((s) => s.minutes !== null).map((s) => s.minutes!))),
      paused,
    },
  };
}

/** May this viewer resolve the report? Admins always; a teacher when the reporter or the reported student is in their groups. */
export async function canResolveReport(viewer: { role: string; teacherId: string | null }, report: { reporterId: string; reportedId: string }): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;
  if (viewer.role !== "TEACHER" || !viewer.teacherId) return false;
  const owned = await db.student.count({
    where: { id: { in: [report.reporterId, report.reportedId] }, group: { teacherId: viewer.teacherId } },
  });
  return owned > 0;
}
