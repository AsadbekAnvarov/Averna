/** Database reads shared by the peer speaking hub and APIs (docs/peer-speaking.md). Server-only. */
import { db } from "@/lib/db";
import { resolvePeerLevel, type PeerLevel } from "./level";
import { FRESH_MS, PEER_FORMATS, type PeerFormat } from "./matching";

/** Open reports at which a student's peer speaking is paused. */
export const PAUSE_REPORTS = 2;
export const PAUSED_MESSAGE = "Peer speaking is paused for your account — please talk to your teacher.";

const YEAR_MS = 365 * 24 * 3600 * 1000;

/** The best available level for a student (sources and order in lib/speaking/level.ts). Never throws. */
export async function studentPeerLevel(student: { id: string; level: string | null; targetBand: string | null }): Promise<PeerLevel> {
  const [speaking, placement] = await Promise.all([
    db.iELTSTest
      .findFirst({
        where: { studentId: student.id, module: "SPEAKING", completedAt: { gte: new Date(Date.now() - YEAR_MS) } },
        orderBy: { completedAt: "desc" },
        select: { score: true },
      })
      .catch(() => null),
    db.placementAttempt
      .findFirst({
        where: { studentId: student.id, status: "finished", band: { not: null } },
        orderBy: { finishedAt: "desc" },
        select: { band: true },
      })
      .catch(() => null),
  ]);
  return resolvePeerLevel({
    speakingBand: speaking?.score ?? null,
    placementBand: placement?.band ?? null,
    levelText: student.level,
    targetBand: student.targetBand,
  });
}

export async function isPeerSpeakingPaused(studentId: string): Promise<boolean> {
  const open = await db.speakingReport.count({ where: { reportedId: studentId, status: "OPEN" } });
  return open >= PAUSE_REPORTS;
}

export interface Presence {
  total: number;
  byFormat: Record<PeerFormat, number>;
}

/** Students looking for a partner right now (fresh heartbeat, not matched), optionally excluding one. */
export async function peerPresence(now: number, excludeStudentId?: string): Promise<Presence> {
  const rows = await db.speakingQueue.findMany({
    where: {
      roomId: null,
      lastSeenAt: { gte: new Date(now - FRESH_MS) },
      ...(excludeStudentId ? { studentId: { not: excludeStudentId } } : {}),
    },
    select: { format: true },
    take: 500,
  });
  const byFormat = Object.fromEntries(PEER_FORMATS.map((f) => [f, 0])) as Record<PeerFormat, number>;
  for (const r of rows) if (r.format in byFormat) byFormat[r.format as PeerFormat] += 1;
  return { total: rows.length, byFormat };
}

/** "Asadbek Anvarov" → "Asadbek". */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : "Student";
}
