import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getGroupMockSummary } from "@/lib/teacher/mock-analytics";
import { MOCK_RULES, formatBand } from "@/lib/teacher/mock-analytics-core";

/**
 * Compact "Mock exams" card for a group page: the average of each student's
 * latest mock and who is due one, linking to /teacher/mock for the group.
 * Async server component; the page has already checked the group is the
 * viewer's.
 */
export async function MockSummaryCard({ groupId, studentIds }: { groupId: string; studentIds: string[] }) {
  const s = await getGroupMockSummary(studentIds);
  const href = `/teacher/mock?group=${encodeURIComponent(groupId)}`;

  let detail: string;
  if (!s) detail = "Mock results can't be loaded right now.";
  else if (s.students === 0) detail = "No students in this group yet.";
  else if (s.withMock === 0) detail = `No finished mocks yet${s.inProgress ? ` · ${s.inProgress} in progress` : ""}.`;
  else {
    const parts = [`${s.withMock} of ${s.students} students ${s.withMock === 1 ? "has" : "have"} sat a mock`];
    if (s.latestAt) parts.push(`last mock ${formatDate(s.latestAt)}`);
    if (s.needsMock) parts.push(`${s.needsMock} ${s.needsMock === 1 ? "needs" : "need"} a mock (none in ${MOCK_RULES.recentDays} days)`);
    if (s.inProgress) parts.push(`${s.inProgress} in progress`);
    detail = parts.join(" · ");
  }

  return (
    <section
      aria-labelledby="group-mock-summary"
      className="mb-8 flex flex-col gap-3 rounded-xl border border-white/5 bg-averna-dark/30 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-averna-neon/15 text-averna-neon">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="group-mock-summary" className="text-sm font-semibold text-white">
            Mock exams
          </h2>
          <p className="text-xs text-gray-400">{detail}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {s && s.averageOverall !== null && (
          <p className="text-right">
            <span className="block text-2xl font-bold tabular-nums leading-none text-white">{formatBand(s.averageOverall)}</span>
            <span className="text-[11px] text-gray-400">latest-mock average</span>
          </p>
        )}
        <Link
          href={href}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-gray-100 hover:border-averna-neon/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
        >
          Mock results
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
