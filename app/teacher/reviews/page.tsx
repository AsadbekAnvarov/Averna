export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Filter, Inbox, Volume2, VolumeX } from "lucide-react";
import { auth } from "@/lib/auth";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkillIconBox, SourceBadge } from "@/components/review/review-badges";
import { formatDuration } from "@/components/exam/results/attempt";
import { getReviewQueue, type QueueRow } from "@/lib/review/queue";
import {
  DAY_OPTIONS,
  DEFAULT_DAYS,
  daysLabel,
  parseQueueFilters,
  queueHref,
  REVIEW_SOURCES,
  reviewHref,
  SOURCE_LABEL,
  type QueueFilters,
} from "@/lib/review/filters";
import { formatBand, formatBandDelta } from "@/lib/review/scoring";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export const metadata = { title: "Review queue" };

type SearchParams = Record<string, string | string[] | undefined>;
const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TAB_BASE =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
const SELECT =
  "h-10 w-full rounded-lg border border-white/15 bg-averna-dark/70 px-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

export default async function ReviewQueuePage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  const role: string = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN") return redirect("/dashboard");
  const viewer = { id: session.user.id as string, role };

  const q = await getReviewQueue(viewer, parseQueueFilters(searchParams));
  if (!q) return redirect("/dashboard");
  if (q.noTeacherProfile) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile, so it has no students to review. Sign in with a teacher account."
      />
    );
  }

  const f = q.filters;
  const saved = firstParam(searchParams.saved) === "1";
  const filtered = !!(f.group || f.skill || f.source || f.days !== DEFAULT_DAYS);
  const user = { name: session.user.name ?? (role === "ADMIN" ? "Admin" : "Teacher"), email: session.user.email ?? "" };
  const tabs = [
    { tab: "pending" as const, label: "Pending", count: q.counts.pending, capped: q.capped.pending },
    { tab: "reviewed" as const, label: "Reviewed", count: q.counts.reviewed, capped: q.capped.reviewed },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        {role === "ADMIN" ? <AdminHeader user={user} /> : <TeacherHeader user={user} />}
        <PageHeader
          back={{ href: role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={ClipboardCheck}
          iconClassName="text-averna-pink"
          title="Review queue"
          subtitle="Writing and Speaking attempts waiting for your band and feedback — homework and mock exams first, then the oldest."
        />

        {saved && (
          <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/10 px-4 py-3 text-sm text-averna-neon">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Review saved — the student sees it on their result page.
            {f.tab === "pending" && q.counts.pending === 0 ? " Nothing else is waiting under these filters." : ""}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Review status" className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const active = f.tab === t.tab;
              return (
                <Link
                  key={t.tab}
                  href={queueHref({ ...f, tab: t.tab, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    TAB_BASE,
                    active
                      ? "bg-averna-pink/15 text-averna-pink ring-1 ring-averna-pink/40"
                      : "border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs tabular-nums",
                      active ? "bg-averna-pink/20 text-averna-pink" : "bg-white/10 text-gray-300"
                    )}
                  >
                    {t.count ?? "–"}
                    {t.capped ? "+" : ""}
                  </span>
                </Link>
              );
            })}
          </nav>
          {q.total > 0 && (
            <p className="text-xs text-gray-400">
              {q.stats.writing} Writing · {q.stats.speaking} Speaking
              {q.stats.homework > 0 && ` · ${q.stats.homework} homework`}
              {q.stats.mock > 0 && ` · ${q.stats.mock} mock`}
            </p>
          )}
        </div>

        <form
          method="get"
          action="/teacher/reviews"
          aria-label="Filter the review queue"
          className="glass mb-5 grid items-end gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        >
          {f.tab === "reviewed" && <input type="hidden" name="tab" value="reviewed" />}
          <div>
            <label htmlFor="rq-group" className="mb-1 block text-xs font-medium text-gray-400">
              Group
            </label>
            <select id="rq-group" name="group" defaultValue={f.group ?? ""} className={SELECT}>
              <option value="" className="bg-averna-dark">
                All groups
              </option>
              {q.groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-averna-dark">
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rq-skill" className="mb-1 block text-xs font-medium text-gray-400">
              Skill
            </label>
            <select id="rq-skill" name="skill" defaultValue={f.skill ?? ""} className={SELECT}>
              <option value="" className="bg-averna-dark">
                Writing and Speaking
              </option>
              <option value="WRITING" className="bg-averna-dark">
                Writing
              </option>
              <option value="SPEAKING" className="bg-averna-dark">
                Speaking
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="rq-source" className="mb-1 block text-xs font-medium text-gray-400">
              Source
            </label>
            <select id="rq-source" name="source" defaultValue={f.source ?? ""} className={SELECT}>
              <option value="" className="bg-averna-dark">
                All sources
              </option>
              {REVIEW_SOURCES.map((s) => (
                <option key={s} value={s} className="bg-averna-dark">
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rq-days" className="mb-1 block text-xs font-medium text-gray-400">
              Submitted
            </label>
            <select id="rq-days" name="days" defaultValue={String(f.days)} className={SELECT}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={String(d)} className="bg-averna-dark">
                  {daysLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-averna-primary px-4 text-sm font-semibold text-white hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Apply
            </button>
            {filtered && (
              <Link
                href={queueHref({ tab: f.tab })}
                className="inline-flex h-10 items-center rounded-lg border border-white/10 px-3 text-sm text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
              >
                Reset
              </Link>
            )}
          </div>
        </form>

        {q.truncated && (
          <p className="mb-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
            There are more attempts than the queue can list at once — choose a shorter period or a group to see the rest.
          </p>
        )}

        {q.rows.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10">
            {role === "TEACHER" && q.groups.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No groups yet"
                description="Your students' Writing and Speaking attempts appear here once you teach a group."
              />
            ) : f.tab === "pending" ? (
              <EmptyState
                icon={CheckCircle2}
                accent="text-averna-neon"
                title="All caught up"
                description={
                  filtered
                    ? "Nothing is waiting for review under these filters."
                    : `No Writing or Speaking attempts are waiting for review (${daysLabel(f.days).toLowerCase()}).`
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No reviews yet"
                description={filtered ? "No reviewed attempts match these filters." : "The attempts you review appear here."}
              />
            )}
          </div>
        ) : (
          <>
          {/* Phones: one card per attempt (the 8-column table doesn't fit) */}
          <ul className="space-y-3 md:hidden" aria-label={f.tab === "pending" ? "Attempts waiting for review" : "Reviewed attempts"}>
            {q.rows.map((r) => (
              <QueueCard key={r.testId} r={r} f={f} />
            ))}
          </ul>
          <div className="glass hidden overflow-hidden rounded-2xl border border-white/10 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <caption className="sr-only">
                  {f.tab === "pending" ? "Attempts waiting for review" : "Reviewed attempts"}, page {q.page} of {q.pages}
                </caption>
                <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Student</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Task</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{f.tab === "pending" ? "AI band" : "Band"}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Length</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Audio</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Source</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {q.rows.map((r) => (
                    <QueueTableRow key={r.testId} r={r} f={f} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {q.pages > 1 && (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
            {q.page > 1 ? (
              <Link
                href={queueHref({ ...f, page: q.page - 1 })}
                rel="prev"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Previous
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm text-gray-400">
              Page {q.page} of {q.pages} · {q.total} attempts
            </p>
            {q.page < q.pages ? (
              <Link
                href={queueHref({ ...f, page: q.page + 1 })}
                rel="next"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

/** Phone layout of one queue row: who, what, band, when — and one big action. */
function QueueCard({ r, f }: { r: QueueRow; f: QueueFilters }) {
  const reviewed = r.band !== null;
  return (
    <li className="glass rounded-2xl border border-white/10 p-4">
      <div className="flex items-start gap-3">
        <SkillIconBox skill={r.skill} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{r.studentName}</p>
          <p className="truncate text-xs text-gray-400">
            {r.label}
            {r.sitting ? " · full test" : ""} · {r.groupName ?? "No group"}
          </p>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <p className="text-lg font-bold leading-none text-white">{formatBand(reviewed ? r.band : r.aiBand)}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{reviewed ? "Band" : "AI"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
        <time dateTime={r.submittedAt.toISOString()} title={formatDateTime(r.submittedAt)}>
          {timeAgo(r.submittedAt)}
        </time>
        {r.skill === "WRITING" && r.words !== null && <span className="tabular-nums">{r.words} words</span>}
        {r.skill !== "WRITING" && r.seconds ? <span className="tabular-nums">{formatDuration(r.seconds)}</span> : null}
        {r.audio === "available" && (
          <span className="inline-flex items-center gap-1 text-averna-neon">
            <Volume2 className="h-3.5 w-3.5" aria-hidden /> Recorded
          </span>
        )}
        <SourceBadge source={r.source} title={r.homeworkTitle} />
      </div>
      <Link
        href={reviewHref(r.testId, f)}
        aria-label={`${reviewed ? "Open the review of" : "Review"} ${r.studentName}'s ${r.label}`}
        className={cn(
          "mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold",
          reviewed
            ? "border border-white/10 bg-white/[0.03] text-gray-100 hover:text-white"
            : "bg-averna-primary text-white hover:bg-averna-light"
        )}
      >
        {reviewed ? "Open review" : "Review now"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}

function QueueTableRow({ r, f }: { r: QueueRow; f: QueueFilters }) {
  const reviewed = r.band !== null;
  const delta = reviewed ? formatBandDelta(r.band as number, r.aiBand) : null;
  const short = r.skill === "WRITING" && r.words !== null && r.minWords !== null && r.words < r.minWords;
  return (
    <tr className="align-top transition-colors hover:bg-white/[0.03]">
      <th scope="row" className="px-4 py-3 text-left font-normal">
        <p className="font-medium text-white">{r.studentName}</p>
        <p className="text-xs text-gray-500">{r.groupName ?? "No group"}</p>
      </th>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <SkillIconBox skill={r.skill} className="h-8 w-8" />
          <div className="min-w-0">
            <p className="font-medium text-gray-100">
              {r.label}
              {r.sitting && <span className="ml-1.5 text-xs font-normal text-gray-500">· full test</span>}
            </p>
            <p className="max-w-[18rem] truncate text-xs text-gray-400" title={r.title}>
              {r.title}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums">
        {reviewed ? (
          <>
            <p className="text-base font-bold text-white">{formatBand(r.band)}</p>
            <p className="text-xs text-gray-500">
              AI {formatBand(r.aiBand)}
              {delta && delta !== "±0" ? ` (${delta})` : ""}
            </p>
          </>
        ) : (
          <p className="text-base font-semibold text-gray-200">
            {formatBand(r.aiBand)} <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">AI</span>
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {r.skill === "WRITING" ? (
          <p className={cn("tabular-nums", short ? "text-amber-300" : "text-gray-300")}>
            {r.words ?? "—"} words
            {r.minWords !== null && <span className="text-gray-500"> / {r.minWords}</span>}
            {short && <span className="sr-only"> (under the minimum)</span>}
          </p>
        ) : (
          <>
            <p className="tabular-nums text-gray-300">{r.seconds ? formatDuration(r.seconds) : "—"}</p>
            {r.words !== null && <p className="tabular-nums text-gray-500">{r.words} words</p>}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {r.audio === "available" ? (
          <span className="inline-flex items-center gap-1 text-averna-neon">
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
            Recorded
          </span>
        ) : r.audio === "expired" ? (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <VolumeX className="h-3.5 w-3.5" aria-hidden />
            Expired
          </span>
        ) : (
          <span className="text-gray-600">
            <span aria-hidden>—</span>
            <span className="sr-only">{r.skill === "SPEAKING" ? "Not recorded" : "Not applicable"}</span>
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-300">
        <time dateTime={r.submittedAt.toISOString()} title={formatDateTime(r.submittedAt)}>
          {timeAgo(r.submittedAt)}
        </time>
        {r.reviewedAt && (
          <p className="mt-0.5 text-gray-500">
            reviewed {timeAgo(r.reviewedAt)}
            {r.reviewerName ? ` by ${r.reviewerName}` : ""}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <SourceBadge source={r.source} title={r.homeworkTitle} />
        {r.homeworkTitle && <p className="mt-1 max-w-[11rem] truncate text-xs text-gray-500" title={r.homeworkTitle}>{r.homeworkTitle}</p>}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={reviewHref(r.testId, f)}
          aria-label={`${reviewed ? "Open the review of" : "Review"} ${r.studentName}'s ${r.label}`}
          className={cn(
            "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
            reviewed
              ? "border border-white/10 bg-white/[0.03] text-gray-100 hover:text-white"
              : "bg-averna-primary text-white hover:bg-averna-light"
          )}
        >
          {reviewed ? "Open" : "Review"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}
