import Link from "next/link";
import { ArrowRight, Clock, MessageCircle, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { READING_FULL, rangeLabel } from "@/lib/ielts/format";
import type { ExamTestSummary } from "@/lib/ielts/types";
import type { SpeakingSetSummary } from "@/lib/ielts/catalog";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { SkillIcon, type SkillLike } from "@/components/progression/ui";
import { Chips, DifficultyBadge, KindChips, SourceBadge } from "./badges";

/**
 * Exam-library cards. Server components: they only receive summaries (no
 * passages, scripts or answers). Render them as direct children of a
 * `<RevealGroup as="ul" role="list">` grid — each card is an <li>.
 */

const CARD = "av-panel glow-hover flex h-full flex-col rounded-2xl p-5 sm:p-6";

function slug(id: string): string {
  return encodeURIComponent(id);
}

function CardHead({ skill, title, meta }: { skill: SkillLike; title: string; meta: string }) {
  return (
    <div className="flex items-start gap-3">
      <SkillIcon skill={skill} />
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug text-white sm:text-lg">{title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {meta}
        </p>
      </div>
    </div>
  );
}

function PartRow({ n, href, title, detail, tone }: { n: number; href?: string; title: string; detail: string; tone: string }) {
  const body = (
    <>
      <span aria-hidden className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", tone)}>
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{title}</span>
        <span className="block text-xs text-gray-400">{detail}</span>
      </span>
    </>
  );
  const row = "flex min-h-[44px] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2";
  if (!href) return <div className={row}>{body}</div>;
  return (
    <Link href={href} className={cn("glow-hover group", row)}>
      {body}
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-averna-neon motion-reduce:transition-none"
      />
    </Link>
  );
}

function CardCta({ href, label, context }: { href: string; label: string; context: string }) {
  return (
    <div className="mt-auto pt-5">
      <Link
        href={href}
        className="glow-cta inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light"
      >
        {label}
        <span className="sr-only">: {context}</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{children}</p>;
}

function range(p: { from: number; to: number }): string | null {
  return p.to > 0 ? rangeLabel(p.from, p.to) : null;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function ReadingExamCard({ exam }: { exam: ExamTestSummary }) {
  const href = `/learning/reading/${slug(exam.id)}`;
  const multi = exam.partInfo.length > 1;
  const perPart = exam.full
    ? READING_FULL.minutesPerPart
    : Math.max(5, Math.round(exam.timeLimit / Math.max(1, exam.partInfo.length)));

  return (
    <SpotlightCard as="li" className={CARD}>
      <CardHead skill="READING" title={exam.title} meta={`${exam.questions} questions · ${exam.timeLimit} min`} />
      <div className="mt-3 flex flex-wrap gap-2">
        <DifficultyBadge difficulty={exam.difficulty} />
        <SourceBadge source={exam.source} />
      </div>
      {exam.description && <p className="mt-3 line-clamp-2 text-sm text-gray-300">{exam.description}</p>}

      {exam.partInfo.length > 0 && (
        <div className="mt-4">
          <SectionLabel>{multi ? "Passages · practise one at a time" : "Passage"}</SectionLabel>
          <ol role="list" className="mt-2 space-y-2">
            {exam.partInfo.map((p, i) => {
              const r = range(p);
              return (
                <li key={`${i}-${p.title}`}>
                  <PartRow
                    n={i + 1}
                    href={multi ? `${href}?part=${i}` : undefined}
                    title={p.title || `Passage ${i + 1}`}
                    detail={
                      multi
                        ? [r, `Practise passage ${i + 1} · ${perPart} min`].filter(Boolean).join(" · ")
                        : r ?? `${exam.questions} questions`
                    }
                    tone="bg-averna-cyan/10 text-averna-cyan"
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <KindChips kinds={exam.kinds} className="mt-4" />
      <CardCta href={href} label={exam.full ? "Start full test" : "Start practice test"} context={exam.title} />
    </SpotlightCard>
  );
}

// ---------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------

export function ListeningExamCard({ exam }: { exam: ExamTestSummary }) {
  const href = `/learning/listening/${slug(exam.id)}`;
  const multi = exam.partInfo.length > 1;
  const perPart = Math.max(1, Math.round(exam.timeLimit / Math.max(1, exam.partInfo.length)));
  const parts = `${exam.parts} ${exam.parts === 1 ? "part" : "parts"}`;

  return (
    <SpotlightCard as="li" className={CARD}>
      <CardHead skill="LISTENING" title={exam.title} meta={`${parts} · ${exam.questions} questions · ~${exam.timeLimit} min`} />
      <div className="mt-3 flex flex-wrap gap-2">
        <DifficultyBadge difficulty={exam.difficulty} />
        <SourceBadge source={exam.source} />
      </div>
      {exam.description && <p className="mt-3 line-clamp-2 text-sm text-gray-300">{exam.description}</p>}

      {exam.partInfo.length > 0 && (
        <div className="mt-4">
          <SectionLabel>{multi ? "Parts · practise one at a time" : "Recording"}</SectionLabel>
          <ol role="list" className="mt-2 space-y-2">
            {exam.partInfo.map((p, i) => {
              const custom = p.title && !/^part\s*\d+$/i.test(p.title.trim()) ? p.title : null;
              const detail = [custom, range(p), multi ? `~${perPart} min` : null].filter(Boolean).join(" · ");
              return (
                <li key={`${i}-${p.title}`}>
                  <PartRow
                    n={i + 1}
                    href={multi ? `${href}?part=${i}` : undefined}
                    title={multi ? `Practise Part ${i + 1}` : custom ?? `Part ${i + 1}`}
                    detail={detail || `${exam.questions} questions`}
                    tone="bg-averna-purple/10 text-averna-purple"
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <KindChips kinds={exam.kinds} className="mt-4" />
      <CardCta href={href} label={exam.full ? "Start full test" : "Start practice test"} context={exam.title} />
    </SpotlightCard>
  );
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

export function SpeakingSetCard({ set }: { set: SpeakingSetSummary }) {
  const href = `/learning/speaking-test/${slug(set.id)}`;

  return (
    <SpotlightCard as="li" className={CARD}>
      <CardHead skill="SPEAKING" title={set.title} meta="3 parts · 11–14 min" />
      <div className="mt-3 flex flex-wrap gap-2">
        <SourceBadge source={set.source} />
      </div>

      {set.topics.length > 0 && (
        <div className="mt-4">
          <SectionLabel>Part 1 · Interview</SectionLabel>
          <Chips items={set.topics} max={4} label="Part 1 topics" className="mt-2" />
        </div>
      )}

      {set.cue && (
        <figure className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <figcaption>
            <SectionLabel>Part 2 · Cue card</SectionLabel>
          </figcaption>
          <blockquote className="mt-1.5 flex gap-2 text-sm leading-relaxed text-gray-200">
            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            <p className="line-clamp-3">{set.cue}</p>
          </blockquote>
        </figure>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Part 3 · Discussion that builds on the cue card
      </p>

      <CardCta href={href} label="Start speaking test" context={set.title} />
    </SpotlightCard>
  );
}
