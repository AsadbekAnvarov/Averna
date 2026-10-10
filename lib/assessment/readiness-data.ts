import { cache } from "react";
import { db } from "@/lib/db";
import { practiceReadiness, type ReadinessEvidence } from "./readiness";
/** Project metadata in SQL: never load essays, answers or transcripts for this widget. */
export const getPracticeReadiness = cache(async (studentId: string) => {
  const since = new Date(Date.now() - 90 * 86400000);
  const rows = await db.$queryRaw<ReadinessEvidence[]>`
    SELECT t."id", t."module"::text AS "module", t."score", t."completedAt",
      t."answers"->>'testId' AS "contentKey", t."answers"->>'format' AS "format",
      t."answers"->>'part' AS "part", t."aiAnalysis"->>'totalQuestions' AS "totalQuestions",
      t."aiAnalysis"->>'answeredCount' AS "answeredCount",
      COALESCE(t."aiAnalysis"->>'source', t."aiAnalysis"->>'assessedBy') AS "source",
      t."answers"->>'taskType' AS "taskType", t."answers"->>'examAttemptId' AS "examAttemptId",
      t."answers"->>'recorded' AS "recorded", t."answers"->>'typedAnswers' AS "typedAnswers",
      r."band" AS "teacherBand", t."aiAnalysis"->'perPart' AS "speakingParts",
      r."criteria"->>'pronunciation' AS "pronunciation"
    FROM "ielts_tests" t LEFT JOIN "test_reviews" r ON r."testId" = t."id"
    WHERE t."studentId" = ${studentId} AND t."completedAt" >= ${since}
    ORDER BY t."completedAt" DESC, t."id" ASC LIMIT 1001`;
  const truncated = rows.length > 1000;
  const result = practiceReadiness(rows.slice(0, 1000));
  return { ...result, truncated, narrative: truncated ? `${result.narrative} Limited to the most recent 1,000 records.` : result.narrative };
});
