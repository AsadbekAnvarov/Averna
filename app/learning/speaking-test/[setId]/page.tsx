export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAward } from "@/lib/engine/xp-engine";
import { getSpeakingSet } from "@/lib/ielts/catalog";
import { SpeakingExamRunner } from "@/components/exam/speaking-exam-runner";
import { examHomeworkFor } from "@/lib/homework/exam-homework";

/**
 * Full IELTS Speaking test (Parts 1–3) — practice mode. The runner posts the
 * transcripts to /api/learning/speaking/test itself and shows the assessment.
 *
 * Every visit runs under its own attempt id (?attempt=…): a refresh keeps it,
 * so a retried submission stays idempotent; a visit without one is redirected
 * to a fresh id. The runner keeps nothing across a reload, so an attempt that
 * was already submitted also gets a fresh id — otherwise a second run would be
 * answered with the first run's saved result.
 */

const LIBRARY = "/learning/speaking-test";
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

/** This test's URL with a new attempt id; every other query param is kept. */
function freshAttemptUrl(setId: string, searchParams: SearchParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "attempt" || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) qs.append(key, item);
  }
  qs.set("attempt", randomUUID().replace(/-/g, ""));
  return `${LIBRARY}/${encodeURIComponent(setId)}?${qs.toString()}`;
}

/** True when this attempt id already produced a saved test (its XP ledger row exists). */
async function alreadySubmitted(userId: string, attempt: string): Promise<boolean> {
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return false;
    const award = await findAward(student.id, `test:${attempt}`);
    return typeof award?.refId === "string" && award.refId.length > 0;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: { params: { setId: string } }) {
  const set = await getSpeakingSet(safeDecode(params.setId)).catch(() => null);
  return { title: set ? `${set.title} · Speaking test` : "Speaking test" };
}

export default async function SpeakingTestPage({
  params,
  searchParams = {},
}: {
  params: { setId: string };
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const set = await getSpeakingSet(safeDecode(params.setId));
  if (!set) return redirect(LIBRARY);

  const requested = firstParam(searchParams.attempt);
  const attempt = requested && ATTEMPT_RE.test(requested) ? requested : null;
  if (!attempt || (await alreadySubmitted(session.user.id, attempt))) {
    return redirect(freshAttemptUrl(set.id, searchParams));
  }

  // Exam homework: only kept when it really is this student's homework for this set.
  const hwParam = firstParam(searchParams.hw);
  const student = hwParam
    ? await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } }).catch(() => null)
    : null;
  const homework = student ? await examHomeworkFor(student.id, hwParam, { kind: "SPEAKING", contentId: set.id }) : null;

  return (
    <SpeakingExamRunner
      key={attempt}
      set={set}
      mode="practice"
      attemptId={attempt}
      exitHref={homework ? "/homework" : LIBRARY}
      homeworkId={homework?.homeworkId}
    />
  );
}
