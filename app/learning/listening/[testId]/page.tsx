export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAward } from "@/lib/engine/xp-engine";
import { getListeningExam } from "@/lib/ielts/catalog";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import { resolvePartIndex } from "@/lib/ielts/submit";
import { examHomeworkFor } from "@/lib/homework/exam-homework";
import { ListeningExamRunner } from "@/components/exam/listening-exam-runner";

/**
 * Computer-delivered IELTS Listening practice — all four parts, or one part
 * with ?part=<0-based index>.
 *
 * Every visit runs under its own attempt id (?attempt=…): a refresh keeps it,
 * so the runner's saved answers, audio position and idempotent submission
 * carry on; a new visit without one is redirected to a fresh id. An attempt
 * that was already submitted opens its result instead.
 */

const LIBRARY = "/learning/listening";
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

type SearchParams = Record<string, string | string[] | undefined>;

const firstParam = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function practiceUrl(testId: string, part: number | null, attempt: string, hw?: string | null): string {
  const qs = new URLSearchParams();
  if (part != null) qs.set("part", String(part));
  if (hw) qs.set("hw", hw);
  qs.set("attempt", attempt);
  return `${LIBRARY}/${encodeURIComponent(testId)}?${qs.toString()}`;
}

/** The saved result of this attempt, when it has already been submitted. */
async function submittedResultId(userId: string, attempt: string): Promise<string | null> {
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return null;
    const award = await findAward(student.id, `test:${attempt}`);
    return typeof award?.refId === "string" && award.refId ? award.refId : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { testId: string } }) {
  const test = await getListeningExam(safeDecode(params.testId)).catch(() => null);
  return { title: test ? `${test.title} · Listening` : "Listening test" };
}

export default async function ListeningTestPage({
  params,
  searchParams = {},
}: {
  params: { testId: string };
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const test = await getListeningExam(safeDecode(params.testId));
  if (!test) return redirect(LIBRARY);

  const part = resolvePartIndex(test, firstParam(searchParams.part));
  // Exam homework: only kept when it really is this student's homework for this paper / part.
  const hwParam = firstParam(searchParams.hw);
  const student = hwParam
    ? await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } }).catch(() => null)
    : null;
  const homework = student ? await examHomeworkFor(student.id, hwParam, { kind: "LISTENING", contentId: test.id, part }) : null;
  const requested = firstParam(searchParams.attempt);
  const attempt = requested && ATTEMPT_RE.test(requested) ? requested : null;
  if (!attempt) return redirect(practiceUrl(test.id, part, randomUUID().replace(/-/g, ""), homework?.homeworkId));

  const done = await submittedResultId(session.user.id, attempt);
  if (done) return redirect(`${LIBRARY}/result/${encodeURIComponent(done)}`);

  return (
    <ListeningExamRunner
      test={await listeningClientContent(test)}
      partIndex={part ?? undefined}
      mode="practice"
      attemptId={attempt}
      exitHref={homework ? "/homework" : LIBRARY}
      homeworkId={homework?.homeworkId}
    />
  );
}
