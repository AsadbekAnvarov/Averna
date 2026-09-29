import { CalendarClock, ClipboardCheck, Gauge, Lightbulb, Timer, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SKILL_TONE } from "@/components/progression/ui";
import { targetTone } from "@/components/teacher/mock-charts";
import {
  MOCK_RULES,
  SECTION_LABEL,
  formatBand,
  formatDelta,
  type ActiveMock,
  type InProgressRow,
  type KindBreakdown,
  type KindStat,
  type MockKpis,
  type NeedsMockRow,
  type ObjectiveSkill,
} from "@/lib/teacher/mock-analytics-core";

/**
 * Header KPIs, the question types to teach (with classroom tips) and the
 * "needs a mock" / "in progress" lists of /teacher/mock. Server components,
 * no hooks.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export function MockKpiTiles({ kpis }: { kpis: MockKpis }) {
  const gap = kpis.targetGap;
  const tiles = [
    {
      label: "Students with a mock",
      value: String(kpis.withMock),
      of: kpis.students as number | null,
      sub: `${kpis.recent} in the last ${MOCK_RULES.recentDays} days`,
      icon: Users,
      tone: "text-averna-cyan",
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
    },
    {
      label: "Average overall",
      value: formatBand(kpis.averageOverall),
      of: null,
      sub:
        kpis.target !== null ? (
          <>
            Target {formatBand(kpis.target)}
            {gap !== null && (
              <>
                {" · "}
                <span className={cn("font-semibold", targetTone(gap))}>{formatDelta(gap)}</span> vs own targets
                <br />
                {kpis.onTarget} of {kpis.withMockAndTarget} at or above their target
              </>
            )}
          </>
        ) : (
          "Each student's latest mock · no targets set"
        ),
      icon: Gauge,
      tone: "text-averna-neon",
      iconBg: "bg-averna-neon/15 text-averna-neon",
    },
    {
      label: "Mocks finished",
      value: String(kpis.finished),
      of: null,
      sub: kpis.inProgress ? `${kpis.inProgress} in progress now` : "None in progress now",
      icon: ClipboardCheck,
      tone: "text-averna-purple",
      iconBg: "bg-averna-purple/15 text-averna-purple",
    },
    {
      label: "Need a mock",
      value: String(kpis.needsMock),
      of: null,
      sub: `None in ${MOCK_RULES.recentDays} days${kpis.needsMockInProgress ? ` · ${kpis.needsMockInProgress} sitting one now` : ""}`,
      icon: CalendarClock,
      tone: kpis.needsMock ? "text-amber-300" : "text-averna-neon",
      iconBg: "bg-amber-400/15 text-amber-300",
    },
  ];
  return (
    <ul role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <li key={t.label} className="glass rounded-2xl border border-white/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-400 sm:text-sm">{t.label}</p>
              <span aria-hidden className={cn("hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex", t.iconBg)}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums", t.tone)}>
              {t.value}
              {t.of !== null && (
                <span className="ml-1 text-base font-semibold text-gray-500">
                  <span aria-hidden>/ </span>
                  <span className="sr-only"> of </span>
                  {t.of}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{t.sub}</p>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

/** Green only from the "not weak" line up, so a type listed as weak is never shown in green. */
function accuracyTone(pct: number): { bar: string; text: string } {
  if (pct >= MOCK_RULES.weakBelowPct) return { bar: "bg-averna-neon", text: "text-averna-neon" };
  if (pct >= 60) return { bar: "bg-averna-cyan", text: "text-averna-cyan" };
  if (pct >= 45) return { bar: "bg-amber-300", text: "text-amber-300" };
  return { bar: "bg-averna-pink", text: "text-averna-pink" };
}

function AccuracyRow({ k }: { k: KindStat }) {
  const tone = accuracyTone(k.pct);
  const thin = k.total < MOCK_RULES.minKindQuestions;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 text-gray-200">{k.label}</span>
        <span className={cn("shrink-0 font-semibold tabular-nums", tone.text)}>
          {k.pct}%
          <span className="ml-1.5 text-xs font-normal text-gray-500">
            {k.correct}/{k.total}
            <span className="sr-only"> questions correct</span>
          </span>
        </span>
      </div>
      <span aria-hidden className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.max(2, Math.min(100, k.pct))}%` }} />
      </span>
      {thin && <p className="mt-0.5 text-[11px] text-gray-500">Few questions so far — read with care</p>}
    </li>
  );
}

export function QuestionTypesPanel({ kinds }: { kinds: KindBreakdown }) {
  const lists: { skill: ObjectiveSkill; list: KindStat[] }[] = [
    { skill: "READING", list: kinds.reading },
    { skill: "LISTENING", list: kinds.listening },
  ];
  const anything = kinds.reading.length + kinds.listening.length > 0;
  if (!anything) {
    return (
      <p className="glass rounded-2xl border border-white/10 p-5 text-sm text-gray-400">
        No mock Reading or Listening sections in the last {MOCK_RULES.kindWindowDays / 30} months yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {kinds.weakest.length > 0 ? (
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {kinds.weakest.map((k) => {
            const tone = accuracyTone(k.pct);
            return (
              <li key={`${k.skill}-${k.kind}`} className="glass flex flex-col rounded-2xl border border-averna-pink/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn("text-[11px] font-semibold uppercase tracking-wider", SKILL_TONE[k.skill].text)}>
                      {SECTION_LABEL[k.skill]}
                    </p>
                    <h3 className="mt-0.5 font-semibold text-white">{k.label}</h3>
                  </div>
                  <p className={cn("shrink-0 text-2xl font-bold tabular-nums", tone.text)}>
                    {k.pct}%<span className="sr-only"> correct</span>
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {k.correct} of {k.total} questions correct · {plural(k.students, "student")}
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-gray-200">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                  <span>
                    <strong className="font-semibold text-white">{k.tip.focus}.</strong> {k.tip.tip}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.06] px-4 py-3 text-sm text-gray-200">
          No question type stands out as weak — every type with at least {MOCK_RULES.minKindQuestions} questions is at{" "}
          {MOCK_RULES.weakBelowPct}% or above.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {lists.map(({ skill, list }) => {
          const id = `mock-kinds-${skill.toLowerCase()}`;
          return (
            <section key={skill} aria-labelledby={id} className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
              <h3 id={id} className="flex items-baseline justify-between gap-3">
                <span className={cn("font-semibold", SKILL_TONE[skill].text)}>{SECTION_LABEL[skill]}</span>
                <span className="text-xs font-normal text-gray-500">{plural(kinds.sections[skill], "section")}</span>
              </h3>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No {SECTION_LABEL[skill]} sections yet.</p>
              ) : (
                <ul role="list" className="mt-3 space-y-3">
                  {list.map((k) => (
                    <AccuracyRow key={k.kind} k={k} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        Pooled from each student&apos;s last {MOCK_RULES.kindMocksPerStudent} mocks of the past {MOCK_RULES.kindWindowDays / 30} months
        ({plural(kinds.students, "student")}).
        {kinds.capped ? ` Limited to the ${MOCK_RULES.maxObjectiveTests} most recent sections.` : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Needs a mock / in progress
// ---------------------------------------------------------------------------

/** How many rows show before "Show N more". */
const VISIBLE = 12;

function daysText(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function sectionText(a: ActiveMock): string {
  return a.section ? `${SECTION_LABEL[a.section]} (${a.sectionIndex + 1} of 4)` : "Finishing";
}

function ActiveChip({ a }: { a: ActiveMock }) {
  return a.stalled ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-gray-300">
      <Timer className="h-3 w-3 text-gray-400" aria-hidden />
      Stalled at {sectionText(a)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <Timer className="h-3 w-3 text-amber-300" aria-hidden />
      Sitting one now · {sectionText(a)}
    </span>
  );
}

function RowList<T>({ items, render, label }: { items: T[]; render: (item: T) => React.ReactNode; label: string }) {
  const head = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);
  return (
    <>
      <ul role="list" className="divide-y divide-white/5">
        {head.map(render)}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer rounded-lg py-2 text-sm font-medium text-averna-neon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60">
            Show {rest.length} more <span className="sr-only">{label}</span>
          </summary>
          <ul role="list" className="divide-y divide-white/5">
            {rest.map(render)}
          </ul>
        </details>
      )}
    </>
  );
}

export function NeedsMockPanel({
  needs,
  inProgress,
  showGroup,
}: {
  needs: NeedsMockRow[];
  inProgress: InProgressRow[];
  showGroup: boolean;
}) {
  const open = inProgress.filter((r) => !r.stalled);
  const stalled = inProgress.filter((r) => r.stalled);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <section aria-labelledby="mock-needs-title" className="glass rounded-2xl border border-amber-300/25 p-4 sm:p-5 lg:col-span-3">
        <h3 id="mock-needs-title" className="font-semibold text-white">
          Needs a mock <span className="text-sm font-normal text-gray-400">({needs.length})</span>
        </h3>
        <p className="text-xs text-gray-400">No finished mock in the last {MOCK_RULES.recentDays} days, or never.</p>
        {needs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-300">Everyone has sat a mock in the last {MOCK_RULES.recentDays} days.</p>
        ) : (
          <div className="mt-2">
            <RowList
              items={needs}
              label="students who need a mock"
              render={(n) => (
                <li key={n.studentId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{n.name}</p>
                    <p className="text-xs text-gray-400">
                      {showGroup && n.groupName ? `${n.groupName} · ` : ""}
                      {n.reason === "never" || !n.lastFinishedAt ? (
                        "Never finished a mock"
                      ) : (
                        <>
                          Last mock {daysText(n.daysSince)} ·{" "}
                          <time dateTime={n.lastFinishedAt}>{formatDate(n.lastFinishedAt)}</time>
                        </>
                      )}
                    </p>
                  </div>
                  {n.active && <ActiveChip a={n.active} />}
                </li>
              )}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="mock-open-title" className="glass rounded-2xl border border-white/10 p-4 sm:p-5 lg:col-span-2">
        <h3 id="mock-open-title" className="font-semibold text-white">
          In progress{" "}
          <span className="text-sm font-normal text-gray-400">
            ({open.length}
            {stalled.length ? ` · ${stalled.length} stalled` : ""})
          </span>
        </h3>
        <p className="text-xs text-gray-400">Mocks started and not finished yet.</p>
        {inProgress.length === 0 ? (
          <p className="mt-4 text-sm text-gray-300">Nobody is sitting a mock right now.</p>
        ) : (
          <div className="mt-2">
            <RowList
              items={[...open, ...stalled]}
              label="mocks in progress"
              render={(r) => (
                <li key={r.attemptId} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-white">{r.name}</p>
                    <ActiveChip a={r} />
                  </div>
                  <p className="text-xs text-gray-400">
                    {showGroup && r.groupName ? `${r.groupName} · ` : ""}
                    Started <time dateTime={r.startedAt}>{formatDate(r.startedAt)}</time>
                    {r.stalled && (
                      <>
                        {" · "}untouched since <time dateTime={r.updatedAt}>{formatDate(r.updatedAt)}</time> — they&apos;ll get a
                        fresh sitting next time
                      </>
                    )}
                  </p>
                </li>
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
}
