/**
 * Server half of the one-button mini task: the student's recent graded Reading
 * / Listening items (a key-and-flag SQL projection — never answers or
 * passages), their done papers and the cached catalog summaries, fed to the
 * pure builder (./mini-task). The caller has already checked that the viewer
 * teaches this student (lib/access).
 *
 * MistakeEntry rows are free-text corrections the student saved (wrong /
 * right / note) with no question type, so they can't say WHICH type to
 * practise; the type comes from the graded items.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { listListeningExams, listReadingExams } from "@/lib/ielts/catalog";
import type { ExamSkill, ExamTestSummary } from "@/lib/ielts/types";
import { doneContentKeys } from "@/lib/review/practice-data";
import { tashkentDateKey } from "@/lib/utils";
import { kindStats, parseItems, type AttemptItems } from "./kind-stats";
import { buildMiniTask, type MiniTask } from "./mini-task";

type Row = { module: string; examId: string | null; score: number; items: unknown };

/** Graded attempts read (newest first). */
const ATTEMPTS = 8;

export async function loadMiniTask(studentId: string): Promise<MiniTask | null> {
  const [rows, reading, listening, doneReading, doneListening] = await Promise.all([
    db.$queryRaw<Row[]>`
      SELECT t."module"::text AS "module", t."answers"->>'examId' AS "examId", t."score",
        (SELECT jsonb_agg(jsonb_build_array(i->'n', i->>'kind', i->'correct'))
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t."aiAnalysis"->'items') = 'array' THEN t."aiAnalysis"->'items' ELSE '[]'::jsonb END) i
        ) AS "items"
      FROM "ielts_tests" t
      WHERE t."studentId" = ${studentId} AND t."module"::text IN ('READING', 'LISTENING')
      ORDER BY t."completedAt" DESC, t."id" DESC
      LIMIT ${ATTEMPTS}`.catch((e: unknown) => {
      console.error("Mini task: graded items failed:", e instanceof Error ? e.message : e);
      return [] as Row[];
    }),
    listReadingExams().catch(() => [] as ExamTestSummary[]),
    listListeningExams().catch(() => [] as ExamTestSummary[]),
    doneContentKeys(studentId, "READING"),
    doneContentKeys(studentId, "LISTENING"),
  ]);

  const attempts: AttemptItems[] = rows
    .filter((r) => r.module === "READING" || r.module === "LISTENING")
    .map((r) => ({ skill: r.module as ExamSkill, examId: r.examId, items: parseItems(r.items) }));
  const summaries = new Map([...reading, ...listening].map((s) => [`${s.skill}:${s.id}`, s]));
  const stats = kindStats(attempts, (skill, id) => summaries.get(`${skill}:${id}`));

  // The weaker objective skill by recent average band (no data → Listening, the shorter task).
  const avg = (skill: ExamSkill) => {
    const xs = rows.filter((r) => r.module === skill && Number(r.score) > 0).map((r) => Number(r.score));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const r = avg("READING");
  const l = avg("LISTENING");
  const fallbackSkill: ExamSkill | null = r != null && l != null ? (r < l ? "READING" : "LISTENING") : r != null ? "READING" : l != null ? "LISTENING" : null;

  return buildMiniTask({
    stats,
    fallbackSkill,
    catalog: { READING: reading, LISTENING: listening },
    done: { READING: doneReading, LISTENING: doneListening },
    todayKey: tashkentDateKey(),
  });
}
