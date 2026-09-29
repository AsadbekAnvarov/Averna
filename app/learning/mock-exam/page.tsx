export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Coffee,
  History,
  Lightbulb,
  Save,
  ShieldCheck,
  Shuffle,
  Trophy,
  XCircle,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockAvailability, listMockAttempts, type MockAvailability, type MockHistoryItem, type MockSection } from "@/lib/ielts/mock";
import { overallBand } from "@/lib/ielts/bands";
import { Aurora } from "@/components/motion/aurora";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { SKILL_TONE, SkillIcon } from "@/components/progression/ui";
import { MockLeaveButton, MockStartButton } from "@/components/exam/mock-start-button";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "IELTS mock exam" };

// Local copy of the primary button look: a server component can't read values out of a "use client" module.
const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none";

const SECTIONS: { skill: MockSection; title: string; time: string; detail: string }[] = [
  { skill: "LISTENING", title: "Listening", time: "~30 min + 2 min to check", detail: "4 parts · 40 questions — the recording plays ONCE" },
  { skill: "READING", title: "Reading", time: "60 min", detail: "3 passages · 40 questions" },
  { skill: "WRITING", title: "Writing", time: "60 min", detail: "Task 1 (150+ words) and Task 2 (250+ words)" },
  { skill: "SPEAKING", title: "Speaking", time: "11–14 min", detail: "Parts 1–3 with the examiner" },
];

const RULES = [
  { icon: ShieldCheck, text: "The clock runs on our server — a refresh or a second tab can't pause or reset it." },
  { icon: Save, text: "Your answers autosave as you work, so a dropped connection doesn't cost you anything." },
  { icon: Shuffle, text: "Papers are chosen at random from the library, preferring ones you haven't taken yet." },
  { icon: Coffee, text: "You can rest between sections — the next clock starts only when you press Start." },
];

const NEEDS: { key: Exclude<keyof MockAvailability, "ready">; one: string; many: string }[] = [
  { key: "listening", one: "full Listening paper", many: "full Listening papers" },
  { key: "reading", one: "full Reading paper", many: "full Reading papers" },
  { key: "task1", one: "Writing Task 1 prompt", many: "Writing Task 1 prompts" },
  { key: "task2", one: "Writing Task 2 prompt", many: "Writing Task 2 prompts" },
  { key: "speaking", one: "Speaking set", many: "Speaking sets" },
];

const TIPS = [
  { title: "Sit it like test day", text: "One sitting, phone away, ideally at the time of day your real exam starts." },
  {
    title: "Check your tech first",
    text: "Headphones for Listening, a microphone for Speaking, and Chrome or Edge on a computer with a stable connection.",
  },
  { title: "Never leave a blank", text: "Wrong answers don't lose marks in Listening or Reading — a guess can only help." },
  { title: "Split your Writing hour", text: "About 20 minutes for Task 1 and 40 for Task 2 — Task 2 counts twice as much." },
  {
    title: "Extend your Speaking answers",
    text: "Add a reason or an example in Part 1, and keep talking for the full two minutes in Part 2.",
  },
  { title: "Review, then practise", text: "Open each section's answers on the result page, then spend your next week on the weakest skill." },
];

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default async function MockExamHubPage() {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student
    .findUnique({ where: { userId: session.user.id }, select: { id: true } })
    .catch(() => null);
  const [availability, attempts] = await Promise.all([
    getMockAvailability().catch((): MockAvailability | null => null),
    student ? listMockAttempts(student.id) : Promise.resolve<MockHistoryItem[]>([]),
  ]);
  const active = attempts.find((a) => a.status === "active") ?? null;
  const finished = attempts.filter((a) => a.status === "finished");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <Hero />
        <div className="mt-6">
          {active ? <ActiveMock item={active} /> : <StartMock availability={availability} isStudent={!!student} />}
        </div>
        <PastMocks items={finished} />
        <Tips />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section
      aria-labelledby="mock-hub-title"
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
          <Trophy className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">IELTS mock exam</p>
          <h1 id="mock-hub-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            A real, full IELTS mock
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            The complete test in the real order, with full 40-question papers and the official timings — about 2 h 50 min in
            total. Your bands for all four skills, and an overall band, arrive at the end.
          </p>
        </div>
      </div>

      <ol role="list" aria-label="The four sections, in order" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s, i) => (
          <li key={s.skill} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <SkillIcon skill={s.skill} className="h-9 w-9" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Section {i + 1}</p>
                <p className="text-sm font-semibold text-white">{s.title}</p>
              </div>
            </div>
            <p className={cn("mt-3 text-sm font-semibold", SKILL_TONE[s.skill].text)}>{s.time}</p>
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

function StartMock({ availability, isStudent }: { availability: MockAvailability | null; isStudent: boolean }) {
  // Unknown (the library couldn't be read): let the start route decide and explain.
  const ready = availability ? availability.ready : true;
  const missing = availability ? NEEDS.filter((n) => availability[n.key] <= 0) : [];
  const reason = !isStudent
    ? "The mock exam is available on student accounts."
    : !ready
      ? "Not enough papers in the library yet."
      : undefined;

  return (
    <section aria-labelledby="mock-start-title" className="av-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="mock-start-title" className="text-lg font-semibold text-white sm:text-xl">
            {ready ? "Ready when you are" : "The mock exam isn't available yet"}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-400">
            {ready
              ? "Set aside about 3 hours with headphones and a microphone. Your papers are drawn the moment you start."
              : `It needs at least one ${joinAnd(missing.map((m) => m.one))} in the library. Ask your teacher to publish more tests.`}
          </p>
          {availability && (
            <ul role="list" aria-label="In the library" className="mt-4 flex flex-wrap gap-2">
              {NEEDS.map((n) => {
                const count = availability[n.key];
                const ok = count > 0;
                return (
                  <li
                    key={n.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                      ok ? "border-white/10 bg-white/5 text-gray-300" : "border-red-300/40 bg-red-500/10 text-red-100"
                    )}
                  >
                    {ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-300" aria-hidden />
                    )}
                    <span className="font-semibold tabular-nums text-white">{count}</span>
                    {count === 1 ? n.one : n.many}
                    {!ok && <span className="sr-only"> (at least one needed)</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <MockStartButton disabled={!ready || !isStudent} disabledReason={reason} className="shrink-0" />
      </div>
    </section>
  );
}

function ActiveMock({ item }: { item: MockHistoryItem }) {
  const idx = Math.max(0, Math.min(SECTIONS.length - 1, item.current));
  const section = SECTIONS[idx];
  const href = `/learning/mock-exam/${encodeURIComponent(item.attemptId)}`;

  return (
    <section aria-labelledby="mock-active-title" className="av-panel av-panel-hero rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
            <span aria-hidden className="h-2 w-2 rounded-full bg-averna-neon motion-safe:animate-pulse-slow" />
            In progress
          </p>
          <h2 id="mock-active-title" className="mt-2 text-lg font-semibold text-white sm:text-xl">
            You have a mock exam in progress
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Started {formatDateTime(item.startedAt)} · you&apos;re on section {idx + 1} of {SECTIONS.length}, {section.title}.
          </p>
          <ol role="list" aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s, i) => {
              const done = i < item.current;
              const current = i === idx;
              return (
                <li
                  key={s.skill}
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
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {s.title}
                  <span className="sr-only">{done ? " (done)" : current ? " (current)" : " (to come)"}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          {/* A full page load, not a client navigation: the exam always opens from the server's latest state. */}
          <a href={href} className={PRIMARY_BTN}>
            Resume — section {idx + 1} of {SECTIONS.length}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <MockLeaveButton attemptId={item.attemptId} label="Leave this mock" />
        </div>
      </div>
    </section>
  );
}

function PastMocks({ items }: { items: MockHistoryItem[] }) {
  return (
    <section aria-labelledby="mock-history-title" className="mt-10">
      <Reveal className="mb-4">
        <h2 id="mock-history-title" className="flex items-baseline gap-2 text-lg font-semibold text-white">
          Your past mocks
          {items.length > 0 && <span className="text-sm font-normal tabular-nums text-gray-500">{items.length}</span>}
        </h2>
        <p className="mt-0.5 text-sm text-gray-400">The overall band and the four section bands of the mocks you&apos;ve finished.</p>
      </Reveal>
      {items.length === 0 ? (
        <Reveal>
          <div className="av-panel rounded-2xl px-6 py-10 text-center">
            <span aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-averna-neon/10 text-averna-neon">
              <History className="h-6 w-6" />
            </span>
            <p className="mt-4 text-base font-semibold text-white">No finished mocks yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
              When you finish a mock, its overall band and section bands appear here, with a link to the full result.
            </p>
          </div>
        </Reveal>
      ) : (
        <RevealGroup as="ul" role="list" className="grid gap-3">
          {items.map((item) => (
            <HistoryRow key={item.attemptId} item={item} />
          ))}
        </RevealGroup>
      )}
    </section>
  );
}

function HistoryRow({ item }: { item: MockHistoryItem }) {
  const bands = SECTIONS.map((s) => item.bands[s.skill]);
  const overall = item.overall ?? overallBand(bands.map((b) => b ?? 0));
  const date = item.finishedAt ?? item.startedAt;
  const href = `/learning/mock-exam/result/${encodeURIComponent(item.attemptId)}`;

  return (
    <li className="av-panel glow-hover relative rounded-2xl p-4 focus-within:border-averna-neon/40 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4 md:w-56 md:shrink-0">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-averna-neon/30 bg-averna-neon/[0.07]">
            <span className="text-2xl font-bold tabular-nums leading-none text-white">{overall.toFixed(1)}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Overall</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{formatDate(date)}</p>
            <p className="text-xs text-gray-500">Full mock · 4 sections</p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {SECTIONS.map((s, i) => {
            const band = bands[i];
            return (
              <div key={s.skill} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                <dt className={cn("text-xs font-medium", SKILL_TONE[s.skill].text)}>{s.title}</dt>
                <dd className="text-sm font-semibold tabular-nums text-white">{band != null ? band.toFixed(1) : "—"}</dd>
              </div>
            );
          })}
        </dl>
        <Link
          href={href}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-xl px-3 text-sm font-semibold text-averna-neon transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 md:self-center"
        >
          See result
          <span className="sr-only"> of the mock on {formatDate(date)}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function Tips() {
  return (
    <section aria-labelledby="mock-tips-title" className="mt-10">
      <Reveal className="mb-4">
        <h2 id="mock-tips-title" className="flex items-center gap-2 text-lg font-semibold text-white">
          <Lightbulb className="h-5 w-5 text-averna-neon" aria-hidden />
          How to prepare
        </h2>
        <p className="mt-0.5 text-sm text-gray-400">A mock tells you the most when you treat it like the real thing.</p>
      </Reveal>
      <RevealGroup as="ul" role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TIPS.map((t) => (
          <li key={t.title} className="av-panel rounded-2xl p-4 sm:p-5">
            <p className="text-sm font-semibold text-white">{t.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">{t.text}</p>
          </li>
        ))}
      </RevealGroup>
    </section>
  );
}
