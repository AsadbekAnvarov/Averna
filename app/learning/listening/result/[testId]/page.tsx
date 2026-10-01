export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListeningExam } from "@/lib/ielts/catalog";
import { toReviewRecording } from "@/lib/ielts/sanitize";
import { ObjectiveResult } from "@/components/exam/results/objective-result";
import { parseObjectiveAttempt, parseTargetBand, resultHref } from "@/components/exam/results/attempt";
import { canViewStudent } from "@/lib/access";
import { homeworkNoticeFor } from "@/lib/homework/exam-homework";

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

  const row = await db.iELTSTest.findUnique({
    where: { id: params.testId },
    include: { student: { include: { user: { select: { name: true } } } } },
  });
  if (!row) return redirect(LIBRARY);
  // The student, a teacher of their group, or an admin.
  const viewerIsOwner = row.student.userId === session.user.id;
  if (!viewerIsOwner && !(await canViewStudent(session.user, row.studentId))) return redirect(LIBRARY);
  const student = row.student;

  const attempt = parseObjectiveAttempt(row);
  if (!attempt) return redirect(LIBRARY);
  if (attempt.skill !== "LISTENING") return redirect(resultHref(attempt.skill, row.id));

  const [exam, xp, homeworkNotice] = await Promise.all([
    getListeningExam(attempt.examId),
    xpForTest(student.id, row.id),
    // Open homework for this paper / part that this attempt didn't complete (owner only).
    viewerIsOwner ? homeworkNoticeFor(student.id, row) : Promise.resolve(null),
  ]);

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
      viewerIsOwner={viewerIsOwner}
      studentName={student.user?.name ?? undefined}
      homeworkNotice={homeworkNotice}
      // A real recording (CDI): its transcript is shown per part, and every question can be replayed
      // from where its answer is spoken. Safe here: this page only exists for a submitted attempt,
      // and only its student, their teacher or an admin gets this far (checks above).
      recording={toReviewRecording(exam)}
    />
  );
}
