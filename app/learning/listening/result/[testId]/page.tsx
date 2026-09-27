export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListeningExam } from "@/lib/ielts/catalog";
import { ObjectiveResult } from "@/components/exam/results/objective-result";
import { parseObjectiveAttempt, parseTargetBand, resultHref } from "@/components/exam/results/attempt";

export const metadata = { title: "Listening results" };

const LIBRARY = "/learning/listening";

/** XP paid for this attempt (the ledger row written with the test), or null when unavailable. */
async function xpForTest(studentId: string, testId: string): Promise<number | null> {
  try {
    const row = await db.xpTransaction.findFirst({ where: { studentId, refId: testId } });
    return typeof row?.amount === "number" ? row.amount : null;
  } catch {
    return null;
  }
}

/**
 * Result of a computer-delivered (exam-v2) Listening attempt. Same access rule
 * as the Reading result page: students see their own attempts only. Older
 * Listening practice has no result page, so anything else goes back to the
 * library.
 */
export default async function ListeningResultPage({ params }: { params: { testId: string } }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return redirect("/auth/signin");

  const row = await db.iELTSTest.findUnique({ where: { id: params.testId } });
  if (!row || row.studentId !== student.id) return redirect(LIBRARY);

  const attempt = parseObjectiveAttempt(row);
  if (!attempt) return redirect(LIBRARY);
  if (attempt.skill !== "LISTENING") return redirect(resultHref(attempt.skill, row.id));

  const [exam, xp] = await Promise.all([getListeningExam(attempt.examId), xpForTest(student.id, row.id)]);

  return (
    <ObjectiveResult
      attempt={attempt}
      test={exam}
      testRowId={row.id}
      studentId={student.id}
      timeSpent={row.timeSpent}
      completedAt={row.completedAt}
      xp={xp}
      target={parseTargetBand(student.targetBand)}
    />
  );
}
