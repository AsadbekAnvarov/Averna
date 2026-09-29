export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CalendarClock,
  CalendarDays,
  CircleSlash,
  GraduationCap,
  Info,
  Mic,
  Sparkles,
  Target,
  ThumbsUp,
  Timer,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlacementResult } from "@/lib/placement/placement";
import {
  PLACEMENT_HUB_HREF,
  SECTION_TITLE,
  SECTION_WEIGHTS,
  TOPIC_LABEL,
  placementRunHref,
  recommendationRule,
} from "@/lib/placement/config";
import { CEFR_LEVELS, PLACEMENT_SECTIONS, type PlacementSection, type PlacementSectionResult } from "@/lib/placement/types";
import { Aurora } from "@/components/motion/aurora";
import { Reveal } from "@/components/motion/reveal";
import { SECTION_TONE, SectionIcon } from "@/components/placement/section-icon";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Placement test result" };

const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none";
const SECONDARY_BTN =
  "glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
/** Calm entrance for content that is on screen from the start (Reveal only animates what is below the fold). */
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both";

const fmt = (b: number | undefined | null) => (typeof b === "number" && Number.isFinite(b) ? b.toFixed(1) : "–");
const pct = (w: number | undefined) => `${Math.round((w ?? 0) * 100)} %`;

export default async function PlacementResultPage({ params }: { params: { attemptId: string } }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) return redirect(PLACEMENT_HUB_HREF);

  const r = await getPlacementResult(student.id, params.attemptId);
  if (!r) return redirect(PLACEMENT_HUB_HREF);
  if (r.status !== "finished" || !r.summary) {
    return redirect(r.status === "active" ? placementRunHref(r.attemptId) : PLACEMENT_HUB_HREF);
  }

  const s = r.summary;
  const rule = recommendationRule(s.cefr);
  const finishedAt = r.finishedAt ?? r.startedAt;
  // Older summaries have no flag — the Listening result itself says so.
  const listeningNotAssessed = !!s.listeningNotAssessed || (!!r.sections.LISTENING && !r.sections.LISTENING.scored);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        {/* Level + recommendation */}
        <section
          aria-labelledby="placement-result-title"
          className={cn("av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5", ENTER)}
        >
          <Aurora intensity="soft" />
          <Link
            href={PLACEMENT_HUB_HREF}
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white print:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Placement test
          </Link>

          <div className="mt-2 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Placement test · Result</p>
              <h1 id="placement-result-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Your level: {s.cefr}
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-400">
                <CalendarDays className="h-4 w-4 text-gray-500" aria-hidden />
                {formatDateTime(finishedAt)}
              </p>
              {listeningNotAssessed && (
                <p className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-sm leading-relaxed text-amber-100">
                  <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                  <span>
                    Listening wasn&apos;t assessed — no answers were recorded — so your level comes from your other sections, with
                    Grammar &amp; Vocabulary and Reading counting most. If the audio didn&apos;t play, tell your teacher — the school can let
                    you take the test again sooner.
                  </span>
                </p>
              )}

              <div className="mt-5 rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.05] p-4">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-averna-neon">
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  Recommended course
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {s.recommendation.course}
                  {s.recommendation.target && (
                    <span className="ml-2 text-sm font-semibold text-gray-300">target band {s.recommendation.target}</span>
                  )}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">{rule.blurb}</p>
              </div>
            </div>

            <div className="mx-auto flex flex-col items-center text-center md:mx-0 md:pl-4">
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-averna-neon/40 bg-averna-neon/[0.06] shadow-[0_0_60px_-20px_rgba(0,255,148,0.55)]">
                <span aria-hidden className="text-6xl font-bold tracking-tight text-white">
                  {s.cefr}
                </span>
                <span aria-hidden className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  CEFR level
                </span>
                <span className="sr-only">CEFR level {s.cefr}</span>
              </div>
              <p className="mt-3 text-sm text-gray-300">
                Estimated IELTS <strong className="text-lg font-bold text-white">≈ {fmt(s.band)}</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Sections */}
        <section aria-labelledby="placement-sections-title" className="mt-8">
          <h2 id="placement-sections-title" className={cn("mb-4 text-lg font-semibold text-white", ENTER)}>
            Section by section
          </h2>
          <ul role="list" className="grid gap-4 md:grid-cols-2">
            {PLACEMENT_SECTIONS.map((sec, i) => (
              <SectionCard key={sec} section={sec} result={r.sections[sec]} delay={150 + i * 90} />
            ))}
          </ul>
        </section>

        {/* Strengths + weaknesses */}
        <Reveal as="section" aria-labelledby="placement-sw-title" className="mt-8">
          <h2 id="placement-sw-title" className="mb-4 text-lg font-semibold text-white">
            What stood out
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="av-panel rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ThumbsUp className="h-4 w-4 text-averna-neon" aria-hidden />
                Strengths
              </h3>
              {s.strengths.length ? (
                <ul role="list" className="mt-3 space-y-2">
                  {s.strengths.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-averna-neon" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Nothing is far ahead yet — that will change as you practise.</p>
              )}
            </div>
            <div className="av-panel rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4 text-averna-pink" aria-hidden />
                To work on
              </h3>
              {s.weaknesses.length ? (
                <ul role="list" className="mt-3 space-y-2">
                  {s.weaknesses.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-averna-pink" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">No gaps below your level — your next steps are at the level above.</p>
              )}
            </div>
          </div>
        </Reveal>

        {/* What to study first */}
        {s.studyFirst.length > 0 && (
          <Reveal as="section" aria-labelledby="placement-study-title" className="mt-8">
            <h2 id="placement-study-title" className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <TrendingUp className="h-5 w-5 text-averna-neon" aria-hidden />
              What to study first
            </h2>
            <ul role="list" className="grid gap-3 md:grid-cols-3">
              {s.studyFirst.map((l, i) => (
                <li key={l.href} className="av-panel glow-hover relative flex flex-col rounded-2xl p-4 focus-within:border-averna-neon/40">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Step {i + 1}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-300">{l.reason}</p>
                  <Link
                    href={l.href}
                    className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 pt-3 text-sm font-semibold text-averna-neon transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                  >
                    {l.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* Grammar points to review */}
        {s.review.length > 0 && (
          <Reveal as="section" aria-labelledby="placement-review-title" className="mt-8">
            <div className="av-panel rounded-2xl p-5 sm:p-6">
              <h2 id="placement-review-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                <BookMarked className="h-5 w-5 text-averna-cyan" aria-hidden />
                Grammar & vocabulary points to review
              </h2>
              <p className="mt-1 text-sm text-gray-400">The rules behind the questions you missed, easiest first.</p>
              <ul role="list" className="mt-4 space-y-3">
                {s.review.map((p) => (
                  <li key={`${p.topic}-${p.level}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="text-white">{TOPIC_LABEL[p.topic] ?? p.topic}</span>
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-gray-300">{p.level}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5",
                          p.kind === "gap" ? "bg-averna-pink/15 text-averna-pink" : "bg-averna-cyan/15 text-averna-cyan"
                        )}
                      >
                        {p.kind === "gap" ? "Review" : "Next step"}
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-200">{p.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Speaking + how the level was worked out */}
        <Reveal as="section" aria-label="About this result" className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="av-panel flex items-start gap-3 rounded-2xl p-5">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <Mic className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Speaking comes next</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                Speaking isn&apos;t part of the online test. Your teacher will assess it in a short conversation at your first
                lesson, and may adjust your course after that.
              </p>
            </div>
          </div>
          <div className="av-panel flex items-start gap-3 rounded-2xl p-5">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-averna-cyan/10 text-averna-cyan">
              <Info className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">How your level was worked out</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                {PLACEMENT_SECTIONS.filter((sec) => s.weights[sec])
                  .map((sec) => `${SECTION_TITLE[sec]} ${pct(s.weights[sec])}`)
                  .join(" · ")}
                . The IELTS bands are estimates from a short test (at most 7.5 per section) — a full mock exam gives a closer
                picture.
              </p>
              {listeningNotAssessed && (
                <p className="mt-1 text-xs text-gray-500">
                  Listening wasn&apos;t assessed (normally {pct(SECTION_WEIGHTS.LISTENING)}), so the other sections share its
                  weight.
                </p>
              )}
              {!s.weights.WRITING && (
                <p className="mt-1 text-xs text-gray-500">Writing wasn&apos;t included (normally {pct(SECTION_WEIGHTS.WRITING)}).</p>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal as="nav" aria-label="What to do next" className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center print:hidden">
          <Link href="/learning" className={PRIMARY_BTN}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Start learning
          </Link>
          <Link href="/dashboard" className={SECONDARY_BTN}>
            Back to the dashboard
          </Link>
          <p className="flex items-center gap-2 text-xs text-gray-500 sm:ml-auto">
            <CalendarClock className="h-4 w-4" aria-hidden />
            {r.retake.allowed
              ? "You can take the placement test again now."
              : r.retake.nextAt
                ? `You can take the placement test again from ${formatDate(r.retake.nextAt)}.`
                : "You can take the placement test again later."}
          </p>
        </Reveal>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionCard({ section, result, delay }: { section: PlacementSection; result: PlacementSectionResult | undefined; delay: number }) {
  const titleId = `placement-section-${section.toLowerCase()}`;
  const tone = SECTION_TONE[section];
  const skipped = !!result?.skipped;
  const notCounted = !!result && !result.scored && !skipped;

  return (
    <li aria-labelledby={titleId} className={cn("av-panel flex flex-col rounded-2xl p-5 sm:p-6", ENTER)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <SectionIcon section={section} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-base font-semibold text-white">
            {SECTION_TITLE[section]}
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {!result
              ? "Not taken"
              : skipped
                ? "Skipped"
                : section === "WRITING"
                  ? `${result.words ?? 0} words`
                  : `${result.correct ?? 0} of ${result.total ?? 0} correct`}
          </p>
        </div>
        {result?.scored && (
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold leading-none text-white">
              <span className="sr-only">Level </span>
              {result.cefr}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-gray-400">
              {section === "GRAMMAR" ? `≈ band ${fmt(result.band)}` : `band ${fmt(result.band)}`}
            </p>
          </div>
        )}
      </div>

      {(result?.auto || notCounted || skipped) && (
        <ul role="list" className="mt-4 flex flex-wrap gap-2">
          {skipped && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs font-medium text-gray-200">
              <CircleSlash className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              {result?.blank
                ? "Nothing was written — not counted"
                : result?.auto
                  ? "Not started within a day — skipped, not counted in your level"
                  : "Skipped — not counted in your level"}
            </li>
          )}
          {notCounted && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
              <CircleSlash className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              No answers recorded — not counted. If the audio didn&apos;t play, tell your teacher.
            </li>
          )}
          {result?.auto && !skipped && (
            <li className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
              <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Time ran out — marked from your autosave
            </li>
          )}
        </ul>
      )}

      {result && section === "GRAMMAR" && result.byLevel && (
        <dl className="mt-4 space-y-2">
          {CEFR_LEVELS.map((lv) => {
            const row = result.byLevel?.[lv];
            if (!row || !row.total) return null;
            const share = Math.round((row.correct / row.total) * 100);
            return (
              <div key={lv} className="flex items-center gap-3">
                <dt className="w-8 shrink-0 text-xs font-semibold text-gray-300">{lv}</dt>
                <dd className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <span className={cn("meter-fill block h-full rounded-full", tone.bar)} style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">
                    {row.correct}/{row.total}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {result && (section === "LISTENING" || section === "READING") && result.scored && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div
              className={cn("meter-fill h-full rounded-full", tone.bar)}
              style={{ width: `${result.total ? Math.round(((result.correct ?? 0) / result.total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            {section === "LISTENING"
              ? "One everyday conversation, so the band is an estimate — a full Listening test covers four recordings."
              : "One short article, so the band is an estimate — a full Reading test has three long passages."}
          </p>
        </div>
      )}

      {result && section === "WRITING" && !skipped && (
        <div className="mt-4 flex flex-1 flex-col">
          {result.criteria && result.assessedBy === "ai" && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["task", "Task response"],
                  ["coherence", "Coherence & cohesion"],
                  ["lexical", "Vocabulary"],
                  ["grammar", "Grammar"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                  <dt className="text-xs text-gray-300">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-white">{fmt(result.criteria?.[k])}</dd>
                </div>
              ))}
            </dl>
          )}
          {(result.feedback ?? []).length > 0 && (
            <ul role="list" className="mt-3 space-y-2">
              {(result.feedback ?? []).map((f) => (
                <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto flex items-start gap-2 pt-4 text-xs leading-relaxed text-gray-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {result.assessedBy === "ai"
                ? "Assessed by Averna's AI examiner. The school can read your text as well."
                : "An automatic estimate from length, vocabulary and sentence variety. The school can read your text as well."}
            </span>
          </p>
        </div>
      )}
    </li>
  );
}
