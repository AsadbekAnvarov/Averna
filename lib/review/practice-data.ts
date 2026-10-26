import { cache } from "react";
import { db } from "@/lib/db";

/**
 * The content keys ("<examId>" / "<examId>#p<n>") of every Reading or
 * Listening paper a student has submitted. Only the key is projected in SQL —
 * never answers or transcripts. Empty on a database error (the picker then
 * simply can't prefer unseen parts). SERVER ONLY.
 */
export const doneContentKeys = cache(async (studentId: string, skill: "READING" | "LISTENING"): Promise<Set<string>> => {
  try {
    const rows = await db.$queryRaw<{ key: string | null }[]>`
      SELECT DISTINCT t."answers"->>'testId' AS "key"
      FROM "ielts_tests" t
      WHERE t."studentId" = ${studentId} AND t."module"::text = ${skill}
      LIMIT 5000`;
    return new Set(rows.map((r) => r.key).filter((k): k is string => typeof k === "string" && k.length > 0));
  } catch {
    return new Set();
  }
});
