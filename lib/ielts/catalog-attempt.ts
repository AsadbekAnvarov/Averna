import { db } from "@/lib/db";
import { getListeningExam, getReadingExam, listeningFromRow, readingFromRow } from "./catalog";
import type { ExamListeningTest, ExamReadingTest } from "./types";

/**
 * Papers a student already has an attempt with (result pages, a mock section
 * already handed out): published or not, so a paper taken offline can still be
 * finished and reviewed. New attempts, libraries, pools and direct links keep
 * using the published-only get*Exam. SERVER ONLY.
 */

export async function getReadingExamForAttempt(id: string): Promise<ExamReadingTest | null> {
  const published = await getReadingExam(id);
  if (published) return published;
  try {
    const row = await db.generatedTest.findUnique({ where: { id }, select: { id: true, data: true, module: true } });
    return row && row.module === "READING" ? readingFromRow(row) : null;
  } catch {
    return null;
  }
}

export async function getListeningExamForAttempt(id: string): Promise<ExamListeningTest | null> {
  const published = await getListeningExam(id);
  if (published) return published;
  try {
    const row = await db.generatedTest.findUnique({ where: { id }, select: { id: true, data: true, module: true } });
    return row && row.module === "LISTENING" ? listeningFromRow(row) : null;
  } catch {
    return null;
  }
}
