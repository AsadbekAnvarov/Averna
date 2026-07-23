import { db } from "@/lib/db";

/**
 * M5 — Journey Replay (data layer).
 *
 * Reconstructs anonymous learning sessions from the real activity log: groups
 * each student's actions into sessions (a >30-minute gap starts a new one) and
 * flags friction points (long pauses, repeated attempts, quick bounces) with
 * simple rules. Read-only. Timestamps are returned as numbers so the data can
 * be handed straight to a client player. Uzbek labels.
 */

const SESSION_GAP_MS = 30 * 60 * 1000;
const FRICTION_PAUSE_MIN = 5;

const ACTION_LABEL_UZ: Record<string, string> = {
  IELTS_TEST_COMPLETED: "IELTS test yakunlandi",
  HOMEWORK_SUBMITTED: "Uy vazifasi yuborildi",
  SPEAKING_SESSION_COMPLETED: "Gapirish mashqi",
  DAILY_CHALLENGE: "Kunlik challenge",
  ACHIEVEMENT_UNLOCKED: "Yutuq ochildi",
};

function label(action: string): string {
  return (
    ACTION_LABEL_UZ[action] ??
    action
      .toLowerCase()
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export interface JourneyEvent {
  action: string;
  label: string;
  ts: number;
  gapMin: number;
  points: number;
  friction: string | null;
}

export interface JourneySession {
  id: string;
  student: string;
  startTs: number;
  endTs: number;
  durationMin: number;
  eventCount: number;
  frictionCount: number;
  events: JourneyEvent[];
}

export async function getRecentJourneys(limit = 8): Promise<JourneySession[]> {
  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      studentId: true,
      action: true,
      points: true,
      createdAt: true,
      student: { select: { user: { select: { name: true } } } },
    },
  });

  // Group by student (oldest → newest within each)
  const byStudent = new Map<string, typeof logs>();
  for (const l of logs) {
    const arr = byStudent.get(l.studentId) ?? [];
    arr.push(l);
    byStudent.set(l.studentId, arr);
  }

  const sessions: JourneySession[] = [];

  for (const [studentId, rawItems] of byStudent) {
    const items = [...rawItems].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const name = items[0]?.student?.user?.name?.split(" ")[0] || "Oʻquvchi";
    const anon = `${name} #${studentId.slice(-4)}`;

    let current: JourneyEvent[] = [];
    let prevTs = 0;

    const flush = () => {
      if (current.length === 0) return;
      const startTs = current[0].ts;
      const endTs = current[current.length - 1].ts;
      sessions.push({
        id: `${studentId}-${startTs}`,
        student: anon,
        startTs,
        endTs,
        durationMin: Math.round((endTs - startTs) / 60000),
        eventCount: current.length,
        frictionCount: current.filter((e) => e.friction).length,
        events: current,
      });
      current = [];
    };

    let sameStreak = 0;
    let lastAction = "";
    for (const it of items) {
      const ts = it.createdAt.getTime();
      const gapFromPrev = prevTs ? ts - prevTs : 0;

      if (prevTs && gapFromPrev > SESSION_GAP_MS) {
        flush();
        sameStreak = 0;
        lastAction = "";
      }

      const gapMin = current.length === 0 ? 0 : Math.round(gapFromPrev / 60000);
      sameStreak = it.action === lastAction ? sameStreak + 1 : 0;
      lastAction = it.action;

      let friction: string | null = null;
      if (gapMin >= FRICTION_PAUSE_MIN) friction = "Uzoq pauza";
      else if (sameStreak >= 2) friction = "Takroriy urinish";

      current.push({ action: it.action, label: label(it.action), ts, gapMin, points: it.points, friction });
      prevTs = ts;
    }
    flush();
  }

  // Single-event sessions are "bounces"
  for (const s of sessions) {
    if (s.eventCount === 1 && s.events[0].friction == null) {
      s.events[0].friction = "Tez chiqib ketish";
      s.frictionCount = 1;
    }
  }

  return sessions.sort((a, b) => b.startTs - a.startTs).slice(0, limit);
}
