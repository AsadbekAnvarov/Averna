export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Coffee,
  Compass,
  Mic,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimateListeningMinutes } from "@/lib/ielts/format";
import { CURRENT_FORM_ID, getPlacementForm } from "@/lib/placement/content";
import { getPlacementOverview } from "@/lib/placement/placement";
import {
  RETAKE_DAYS,
  SECTION_MINUTES,
  SECTION_TITLE,
  TOTAL_MINUTES_CORE,
  placementResultHref,
  placementRunHref,
} from "@/lib/placement/config";
import { PLACEMENT_SECTIONS, type PlacementOverview, type PlacementSection } from "@/lib/placement/types";
import { Aurora } from "@/components/motion/aurora";
import { CefrChip, SECTION_TONE, SectionIcon } from "@/components/placement/section-icon";
import { PlacementLeaveButton, PlacementStartButton } from "@/components/placement/placement-actions";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Placement test" };

// Local copy of the primary button look: a server component can't read values out of a "use client" module.
const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none";

const RULES = [
  { icon: ShieldCheck, text: "Each section's clock runs on our server — a refresh, a second tab or leaving the test can't pause or reset it." },
  { icon: Save, text: "Your answers save as you work, so a dropped connection doesn't cost you anything." },
  { icon: Coffee, text: "You can rest between sections — the next clock starts only when you press Start." },
  { icon: Sparkles, text: "No XP, no pass or fail: the test only finds the course that fits you." },
];

function outline(): { section: PlacementSection; time: string; detail: string }[] {
  const form = getPlacementForm(CURRENT_FORM_ID);
  const listening = form ? estimateListeningMinutes(form.listening) : 8;
  const count = (section: "LISTENING" | "READING") =>
    form ? form[section === "LISTENING" ? "listening" : "reading"].parts.flatMap((p) => p.groups).reduce((n, g) => n + g.questions.length, 0) : 10;
  return [
    { section: "GRAMMAR", time: `${SECTION_MINUTES.GRAMMAR} min`, detail: `${form?.grammar.length ?? 30} multiple-choice questions, from easy to hard` },
    { section: "LISTENING", time: `about ${listening} min`, detail: `One everyday conversation · ${count("LISTENING")} questions · the recording plays once` },
    { section: "READING", time: `${form?.reading.timeLimit ?? SECTION_MINUTES.READING} min`, detail: `One short article · ${count("READING")} questions` },
    {
      section: "WRITING",
      time: `${SECTION_MINUTES.WRITING} min · optional`,
      detail: `${form?.writing.minWords ?? 120}–${form?.writing.maxWords ?? 150} words giving your opinion — you can skip it`,
    },
  ];
}

export default async function PlacementHubPage() {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } }).catch(() => null);
  const overview = student ? await getPlacementOverview(student.id) : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <Hero />
        <div className="mt-6">
          {!overview ? (
            <NotStudent />
          ) : overview.active ? (
            <ActiveSitting active={overview.active} />
          ) : (
            <StartCard overview={overview} />
          )}
        </div>
        {overview?.last && <LastResult last={overview.last} />}
        <SpeakingNote />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section
      aria-labelledby="placement-hub-title"
      className="av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5"
    >
      <Aurora intensity="soft" />
      <Link
        href="/learning"
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Learning Center
      </Link>
      <div className="mt-2 flex items-start gap-4">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-averna-neon/10 text-averna-neon">
          <Compass className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Placement test</p>
          <h1 id="placement-hub-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Find your level
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            About {TOTAL_MINUTES_CORE} minutes of grammar, vocabulary, listening and reading — plus a short piece of writing if you
            like. You get your CEFR level, an estimated IELTS band for each skill and the course we recommend for you.
          </p>
        </div>
      </div>

      <ol role="list" aria-label="The sections, in order" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {outline().map((s, i) => (
          <li key={s.section} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <SectionIcon section={s.section} className="h-9 w-9" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Section {i + 1}</p>
                <p className="text-sm font-semibold text-white">{SECTION_TITLE[s.section]}</p>
              </div>
            </div>
            <p className={cn("mt-3 text-sm font-semibold", SECTION_TONE[s.section].text)}>{s.time}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{s.detail}</p>
          </li>
        ))}
      </ol>

      <ul role="list" className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {RULES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-sm leading-relaxed text-gray-300">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotStudent() {
  return (
    <section className="av-panel rounded-3xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">The placement test is for students</h2>
      <p className="mt-1 text-sm text-gray-400">Sign in with a student account to take it.</p>
    </section>
  );
}

function StartCard({ overview }: { overview: PlacementOverview }) {
  const { retake, last } = overview;
  if (!retake.allowed) {
    return (
      <section aria-labelledby="placement-wait-title" className="av-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-cyan/10 text-averna-cyan">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="placement-wait-title" className="text-lg font-semibold text-white sm:text-xl">
              You can take the test again {retake.nextAt ? `from ${formatDate(retake.nextAt)}` : "soon"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
              {retake.unfinished
                ? `You left your last test after a section had started, so it counts as taken. A new test is possible ${RETAKE_DAYS} days after it, so that it shows real progress.`
                : `A retake is possible ${RETAKE_DAYS} days after your last test, so that it shows real progress.`}{" "}
              If you need to take it sooner, ask your teacher or the school office.
            </p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="placement-start-title" className="av-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="placement-start-title" className="text-lg font-semibold text-white sm:text-xl">
            {last ? "Ready to measure your progress?" : "Ready when you are"}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-400">
            {last
              ? retake.override
                ? "Your teacher has opened a retake for you. Your new result will replace the level on your profile."
                : "It's been long enough since your last test to see real progress. Your new result replaces the level on your profile."
              : "Find a quiet place with headphones. Answer on your own — the result decides which course suits you, so a real picture helps you most."}
          </p>
        </div>
        <PlacementStartButton label={last ? "Take the test again" : "Start the placement test"} className="shrink-0" />
      </div>
    </section>
  );
}

function ActiveSitting({ active }: { active: NonNullable<PlacementOverview["active"]> }) {
  const idx = Math.max(0, Math.min(PLACEMENT_SECTIONS.length - 1, active.current));
  return (
    <section aria-labelledby="placement-active-title" className="av-panel av-panel-hero rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
            <span aria-hidden className="h-2 w-2 rounded-full bg-averna-neon motion-safe:animate-pulse-slow" />
            In progress
          </p>
          <h2 id="placement-active-title" className="mt-2 text-lg font-semibold text-white sm:text-xl">
            You have a placement test in progress
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Started {formatDateTime(active.startedAt)} · you&apos;re on section {idx + 1} of {active.sections},{" "}
            {SECTION_TITLE[PLACEMENT_SECTIONS[idx]]}.
          </p>
          <ol role="list" aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {PLACEMENT_SECTIONS.map((s, i) => {
              const done = i < active.current;
              const current = i === idx;
              return (
                <li
                  key={s}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                    done
                      ? "border-averna-neon/30 bg-averna-neon/[0.07] text-gray-200"
                      : current
                        ? "border-averna-neon/50 text-white"
                        : "border-white/10 text-gray-500"
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" aria-hidden /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden />}
                  {SECTION_TITLE[s]}
                  <span className="sr-only">{done ? " (done)" : current ? " (current)" : " (to come)"}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          {/* A full page load, not a client navigation: the test always opens from the server's latest state. */}
          <a href={placementRunHref(active.attemptId)} className={PRIMARY_BTN}>
            Resume — section {idx + 1} of {active.sections}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <PlacementLeaveButton
            attemptId={active.attemptId}
            started={active.started}
            atWritingIntro={active.atWritingIntro}
            label="Leave this test"
          />
        </div>
      </div>
    </section>
  );
}

function LastResult({ last }: { last: NonNullable<PlacementOverview["last"]> }) {
  return (
    <section aria-labelledby="placement-last-title" className="mt-8">
      <h2 id="placement-last-title" className="mb-4 text-lg font-semibold text-white">
        Your last result
      </h2>
      <div className="av-panel glow-hover relative rounded-2xl p-4 focus-within:border-averna-neon/40 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4 md:w-64 md:shrink-0">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-averna-neon/30 bg-averna-neon/[0.07]">
              <span className="text-2xl font-bold leading-none text-white">{last.cefr ?? "—"}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Level</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{formatDate(last.finishedAt)}</p>
              <p className="text-xs text-gray-500">
                {last.band != null ? `Estimated IELTS ${last.band.toFixed(1)}` : "Placement test"}
              </p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recommended course</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
              {last.cefr && <CefrChip cefr={last.cefr} />}
              {last.recommendation ?? "—"}
            </p>
          </div>
          <Link
            href={placementResultHref(last.attemptId)}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-xl px-3 text-sm font-semibold text-averna-neon transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 md:self-center"
          >
            See full result
            <span className="sr-only"> of the placement test on {formatDate(last.finishedAt)}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SpeakingNote() {
  return (
    <section aria-labelledby="placement-speaking-title" className="mt-8">
      <div className="av-panel flex items-start gap-3 rounded-2xl p-4 sm:p-5">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
          <Mic className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="placement-speaking-title" className="text-sm font-semibold text-white sm:text-base">
            What about Speaking?
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
            Speaking isn&apos;t part of the online test. Your teacher will assess your speaking in a short conversation at your
            first lesson.
          </p>
        </div>
      </div>
    </section>
  );
}
