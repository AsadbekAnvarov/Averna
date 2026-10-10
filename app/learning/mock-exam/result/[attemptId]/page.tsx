export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleSlash,
  ClipboardCheck,
  Clock,
  FileText,
  Info,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewStudent } from "@/lib/access";
import { getMockResult, type MockResultView, type MockSection, type MockSectionResult } from "@/lib/ielts/mock";

import { Aurora } from "@/components/motion/aurora";
import { Reveal } from "@/components/motion/reveal";
import { BandCountUp } from "@/components/exam/results/band-count-up";
import { formatDuration } from "@/components/exam/results/attempt";
import { SKILL_TONE, SkillIcon } from "@/components/progression/ui";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Mock exam result" };

const HUB = "/learning/mock-exam";
/** Where teachers / admins come from (Mock results by group). */
const STAFF_HUB = "/teacher/mock";

const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none";
const SECONDARY_BTN =
  "glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
const LINK_BTN =
  "glow-hover inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
/** Calm entrance for content that is on screen from the start (Reveal only animates what is below the fold). */
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both";

const TITLE: Record<MockSection, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

const LIBRARY: Record<MockSection, string> = {
  LISTENING: "/learning/listening",
  READING: "/learning/reading",
  WRITING: "/learning/writing",
  SPEAKING: "/learning/speaking-test",
};

const FOCUS_TIP: Record<MockSection, string> = {
  LISTENING:
    "Practise one part at a time, then full tests. Read the questions before each part begins, and listen for paraphrases rather than the exact words.",
  READING: "Practise one passage in 20 minutes, then full tests. Skim first, then scan for the words that match each question.",
  WRITING:
    "Write a Task 2 essay every day or two and act on the examiner's feedback for each criterion — Task 2 counts twice as much as Task 1.",
  SPEAKING:
    "Take full Speaking tests out loud. Extend every answer with a reason or an example, and keep going for the full two minutes in Part 2.",
};

const fmt = (b: number) => (Number.isFinite(b) ? b.toFixed(1) : "–");
const trim = (x: number) => String(Math.round(x * 1000) / 1000);

export default async function MockResultPage(props: { params: Promise<{ attemptId: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  // The student sees their own sitting; their teacher (or an admin) can open it too.
  const attemptId = typeof params.attemptId === "string" ? params.attemptId : "";
  const owner: { studentId: string; student: { userId: string; user: { name: string | null } | null } | null } | null =
    attemptId
      ? await db.mockAttempt
          .findUnique({
            where: { id: attemptId },
            select: { studentId: true, student: { select: { userId: true, user: { select: { name: true } } } } },
          })
          .catch(() => null)
      : null;
  if (!owner?.student) return redirect(HUB);
  const viewerIsOwner = owner.student.userId === session.user.id;
  if (!viewerIsOwner && !(await canViewStudent(session.user, owner.studentId))) return redirect(HUB);
  const studentName = owner.student.user?.name?.trim() || "Student";

  const r = await getMockResult(owner.studentId, attemptId);
  if (!r) return redirect(viewerIsOwner ? HUB : STAFF_HUB);
  if (r.status !== "finished") {
    if (!viewerIsOwner) return redirect(STAFF_HUB);
    return redirect(r.status === "abandoned" ? HUB : `${HUB}/${encodeURIComponent(r.attemptId)}`);
  }

  const sections = r.sections;
  const bands = sections.map((s) => r.results[s]?.band ?? 0);
  const overall = r.overall;
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
  const totalXp = sections.reduce((sum, s) => sum + Math.max(0, Math.round(r.results[s]?.xp ?? 0)), 0);
  const startedAt = new Date(r.startedAt);
  const finishedAt = r.finishedAt ? new Date(r.finishedAt) : null;
  const totalSeconds = finishedAt ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)) : 0;

  const lowest = Math.min(...bands);
  const level = bands.every((b) => b === bands[0]);
  const weakest = level ? null : sections[bands.indexOf(lowest)];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        {/* Overall band */}
        <section
          aria-labelledby="mock-result-title"
          className={cn(
            "av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5",
            ENTER
          )}
        >
          <Aurora intensity="soft" />
          <Link
            href={viewerIsOwner ? HUB : STAFF_HUB}
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white print:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {viewerIsOwner ? "Mock exams" : "Mock results"}
          </Link>

          <div className="mt-2 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">IELTS mock exam · Result</p>
              <h1 id="mock-result-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {viewerIsOwner ? "Your mock exam result" : `${studentName} — mock exam result`}
              </h1>
              <ul role="list" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-400">
                {finishedAt && (
                  <li className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-gray-500" aria-hidden />
                    Finished {formatDateTime(finishedAt)}
                  </li>
                )}
                {totalSeconds > 0 && (
                  <li className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-gray-500" aria-hidden />
                    {formatDuration(totalSeconds)} {r.mode === "cd-v1" ? "elapsed since registration" : "in total, including breaks"}
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-averna-neon" aria-hidden />
                  {totalXp > 0 ? `+${totalXp} XP earned` : "No XP this time"}
                </li>
              </ul>

              <ul role="list" aria-label="Section bands" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sections.map((s, i) => (
                  <li key={s} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className={cn("text-xs font-medium", SKILL_TONE[s].text)}>{TITLE[s]}</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{fmt(bands[i])}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mx-auto flex flex-col items-center text-center md:mx-0 md:pl-4">
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-averna-neon/40 bg-averna-neon/[0.06] shadow-[0_0_60px_-20px_rgba(0,255,148,0.55)]">
                {overall == null ? <span className="text-5xl font-bold text-white">—</span> : <BandCountUp value={overall} className="text-6xl font-bold tabular-nums tracking-tight text-white" />}
                <span aria-hidden className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  {overall == null ? "Speaking separate" : "Overall band"}
                </span>
                <span className="sr-only">{overall == null ? "No four-skill overall: Speaking is separate" : `Overall band ${fmt(overall)}`}</span>
              </div>
            </div>
          </div>

          <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-gray-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            <span>
              {overall == null ? <>This sitting contains Listening, Reading and Writing. Speaking is separate, so no four-skill overall is calculated. <Link href="/learning/speaking" className="underline text-averna-cyan">Open Speaking</Link>.</> : <>{viewerIsOwner ? "Your" : "The"} overall band is the average of the four section bands, rounded to the nearest half band, the way IELTS
              reports it: ({bands.map(fmt).join(" + ")}) ÷ 4 = {trim(mean)} → <strong className="text-white">{fmt(overall)}</strong>.</>}
            </span>
          </p>
        </section>

        {/* The four sections */}
        <section aria-labelledby="mock-sections-title" className="mt-8">
          <h2 id="mock-sections-title" className={cn("mb-4 text-lg font-semibold text-white", ENTER)}>
            Section by section
          </h2>
          <ul role="list" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections.map((s, i) => (
              <SectionCard key={s} skill={s} result={r.results[s]} papers={r.papers} delay={150 + i * 90} viewerIsOwner={viewerIsOwner} />
            ))}
          </ul>
        </section>

        {/* What next */}
        <Reveal as="section" aria-labelledby="mock-focus-title" className="mt-8">
          <div className="av-panel rounded-2xl p-5 sm:p-6">
            {weakest ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <SkillIcon skill={weakest} className="h-11 w-11" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Focus next</p>
                    <h2 id="mock-focus-title" className="mt-0.5 text-lg font-semibold text-white">
                      {TITLE[weakest]} — band {fmt(r.results[weakest]?.band ?? 0)}, {viewerIsOwner ? "your" : "the"} lowest this time
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">{FOCUS_TIP[weakest]}</p>
                  </div>
                </div>
                {viewerIsOwner && (
                  <Link href={LIBRARY[weakest]} className={cn(PRIMARY_BTN, "shrink-0")}>
                    Practise {TITLE[weakest]}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-neon/10 text-averna-neon">
                  <Target className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Focus next</p>
                  <h2 id="mock-focus-title" className="mt-0.5 text-lg font-semibold text-white">
                    {viewerIsOwner ? "Your" : "The"} section bands are level
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
                    No skill is holding the others back. Keep practising these sections — and take another mock in a few weeks to
                    see the whole picture move.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal as="nav" aria-label="What to do next" className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center print:hidden">
          {viewerIsOwner ? (
            <>
              <Link href={HUB} className={PRIMARY_BTN}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Take another mock
              </Link>
              <Link href="/learning" className={SECONDARY_BTN}>
                Back to Learning
              </Link>
            </>
          ) : (
            <>
              <Link href={STAFF_HUB} className={PRIMARY_BTN}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to mock results
              </Link>
              <Link href="/teacher/reviews" className={SECONDARY_BTN}>
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                Review queue
              </Link>
            </>
          )}
        </Reveal>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionCard({
  skill,
  result,
  papers,
  delay,
  viewerIsOwner,
}: {
  skill: MockSection;
  result: MockSectionResult | undefined;
  papers: MockResultView["papers"];
  delay: number;
  viewerIsOwner: boolean;
}) {
  const band = result?.band ?? 0;
  const blank = !result || result.testIds.length === 0;
  const titleId = `mock-section-${skill.toLowerCase()}`;
  const paper =
    skill === "LISTENING" ? papers.listening : skill === "READING" ? papers.reading : skill === "SPEAKING" ? papers.speaking : null;

  return (
    <li
      aria-labelledby={titleId}
      className={cn("av-panel flex flex-col rounded-2xl p-5 sm:p-6", ENTER)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <SkillIcon skill={skill} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-base font-semibold text-white">
            {TITLE[skill]}
          </h3>
          {paper && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
              <FileText className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              <span className="min-w-0 truncate">{paper}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums leading-none text-white">
            <span className="sr-only">Band </span>
            {fmt(band)}
          </p>
          <p aria-hidden className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Band
          </p>
        </div>
      </div>

      {(blank || result?.auto || result?.reviewed) && (
        <ul role="list" className="mt-4 flex flex-wrap gap-2">
          {result?.reviewed && !blank && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-averna-neon/35 bg-averna-neon/10 px-3 text-xs font-medium text-emerald-100">
              <ClipboardCheck className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
              {viewerIsOwner ? "Reviewed by your teacher" : "Reviewed by a teacher"}
            </li>
          )}
          {blank && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs font-medium text-gray-200">
              <CircleSlash className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              No answers were submitted — scored 0
            </li>
          )}
          {result?.auto && !blank && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
              <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Time ran out — graded from {viewerIsOwner ? "your" : "the"} autosave
            </li>
          )}
          {result?.auto && blank && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
              <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Time ran out before anything was saved
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-1 flex-col">
        {skill === "LISTENING" || skill === "READING" ? (
          <ObjectiveDetails skill={skill} result={result} blank={blank} />
        ) : skill === "WRITING" ? (
          <WritingDetails result={result} blank={blank} papers={papers} />
        ) : (
          <SpeakingDetails result={result} blank={blank} viewerIsOwner={viewerIsOwner} />
        )}
      </div>
    </li>
  );
}

function ObjectiveDetails({
  skill,
  result,
  blank,
}: {
  skill: "LISTENING" | "READING";
  result: MockSectionResult | undefined;
  blank: boolean;
}) {
  const total = result?.total ?? 0;
  const correct = result?.correct ?? 0;
  const answered = result?.answered ?? 0;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const testId = result?.testIds[0];

  return (
    <>
      {!blank && total > 0 && (
        <div>
          <p className="text-sm text-gray-200">
            <span className="text-lg font-semibold tabular-nums text-white">
              {correct} / {total}
            </span>{" "}
            correct
            <span className="text-gray-500"> · {answered === total ? "every question answered" : `${total - answered} left blank`}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className={cn("meter-fill h-full rounded-full", SKILL_TONE[skill].bar)} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {testId && (
        <div className="mt-auto pt-5">
          <Link href={`${LIBRARY[skill]}/result/${encodeURIComponent(testId)}`} className={LINK_BTN}>
            Review answers
            <span className="sr-only"> for {TITLE[skill]}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </>
  );
}

function WritingDetails({
  result,
  blank,
  papers,
}: {
  result: MockSectionResult | undefined;
  blank: boolean;
  papers: MockResultView["papers"];
}) {
  const tasks = [
    { label: "Task 1", title: papers.task1, band: result?.task1Band, testId: result?.testIds[0] },
    { label: "Task 2", title: papers.task2, band: result?.task2Band, testId: result?.testIds[1] },
  ];
  return (
    <>
      <dl className="space-y-2">
        {tasks.map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
            <dt className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">{t.label}</span>
              <span className="block truncate text-sm text-gray-200">{t.title}</span>
            </dt>
            <dd className="shrink-0 text-lg font-semibold tabular-nums text-white">
              {!blank && typeof t.band === "number" ? fmt(t.band) : "—"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-gray-500">Task 2 counts twice as much as Task 1 in your Writing band.</p>
      {!blank && (tasks[0].testId || tasks[1].testId) && (
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {tasks.map((t) =>
            t.testId ? (
              <Link key={t.label} href={`${LIBRARY.WRITING}/result/${encodeURIComponent(t.testId)}`} className={LINK_BTN}>
                {t.label} feedback
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null
          )}
        </div>
      )}
    </>
  );
}

const CRITERIA: { key: "fluency" | "lexical" | "grammar"; label: string }[] = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexical", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
];

function SpeakingDetails({
  result,
  blank,
  viewerIsOwner,
}: {
  result: MockSectionResult | undefined;
  blank: boolean;
  viewerIsOwner: boolean;
}) {
  const criteria = result?.criteria;
  const pronunciation = typeof criteria?.pronunciation === "number" && Number.isFinite(criteria.pronunciation) ? criteria.pronunciation : null;
  const reviewed = !!result?.reviewed && !blank;
  const testId = result?.testIds[0];
  const feedback = (result?.feedback ?? []).filter((f) => typeof f === "string" && f.trim());
  return (
    <>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CRITERIA.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
            <dt className="text-xs text-gray-300">{c.label}</dt>
            <dd className="shrink-0 text-base font-semibold tabular-nums text-white">
              {!blank && criteria ? fmt(criteria[c.key]) : "—"}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
          <dt className="text-xs text-gray-300">Pronunciation</dt>
          {!blank && pronunciation !== null ? (
            <dd className="shrink-0 text-base font-semibold tabular-nums text-white">{fmt(pronunciation)}</dd>
          ) : (
            <dd className="max-w-[9rem] shrink-0 text-right text-[11px] font-medium leading-snug text-gray-400">
              {reviewed ? "Not rated" : "Not assessed from text"}
            </dd>
          )}
        </div>
      </dl>

      {!blank && feedback.length > 0 && (
        <ul role="list" className="mt-4 space-y-2">
          {feedback.map((f, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 pt-4 text-xs leading-relaxed text-gray-500">
        {blank ? (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
        ) : (
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
        )}
        <span>
          {blank ? (
            "Nothing was recorded or transcribed for this section."
          ) : reviewed ? (
            <>
              The band is {viewerIsOwner ? "your" : "the"} teacher&apos;s review
              {pronunciation !== null ? ", including Pronunciation." : ". Pronunciation wasn't rated, so it comes from the other three criteria."}
            </>
          ) : (
            <>
              {result?.assessedBy === "ai"
                ? `Assessed by Averna's AI examiner from ${viewerIsOwner ? "your" : "the"} transcript.`
                : `An automatic estimate from ${viewerIsOwner ? "your" : "the"} transcript.`}{" "}
              Pronunciation can&apos;t be judged from a transcript, so the band comes from the other three criteria — a teacher
              can rate it separately.
            </>
          )}
        </span>
      </p>

      {!blank && testId && (
        <div className="mt-auto pt-5">
          <Link href={`${LIBRARY.SPEAKING}/result/${encodeURIComponent(testId)}`} className={LINK_BTN}>
            {viewerIsOwner ? "Answers and feedback" : "Answers, recordings and review"}
            <span className="sr-only"> for Speaking</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </>
  );
}
