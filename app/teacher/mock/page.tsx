export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Download,
  Filter,
  Inbox,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  TrendingUp,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MockKpiTiles, NeedsMockPanel, QuestionTypesPanel } from "@/components/teacher/mock-panels";
import { BandDistribution, CriteriaCard, SectionAverages, TrendChart } from "@/components/teacher/mock-charts";
import { MockStudentTable } from "@/components/teacher/mock-student-table";
import { getMockAnalytics, mockScope, type MockAnalytics, type MockScope } from "@/lib/teacher/mock-analytics";
import { MOCK_RULES, formatBand } from "@/lib/teacher/mock-analytics-core";

export const metadata = { title: "Mock exam results" };

type SearchParams = Record<string, string | string[] | undefined>;

const SELECT =
  "h-10 w-full rounded-lg border border-white/15 bg-averna-dark/70 px-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
const NOTICE = "mb-4 flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function TeacherMockPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? {};
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  const role: string = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN") return redirect("/dashboard");
  const viewer = { id: session.user.id as string, role };
  const user = { name: session.user.name ?? (role === "ADMIN" ? "Admin" : "Teacher"), email: session.user.email ?? "" };

  let scope: MockScope | null = null;
  try {
    scope = await mockScope(viewer, searchParams.group);
  } catch (e) {
    console.error("Mock results: scope failed:", e);
  }
  if (scope && !scope.ok) {
    if (scope.reason === "no-teacher") {
      return (
        <AccountNotice
          title="No teacher profile found"
          message="This account doesn't have a teacher profile, so it has no groups to show. Sign in with a teacher account."
        />
      );
    }
    return redirect("/dashboard");
  }

  let data: MockAnalytics | null = null;
  if (scope) {
    try {
      data = await getMockAnalytics(scope);
    } catch (e) {
      console.error("Mock results: loading failed:", e);
    }
  }

  const header = role === "ADMIN" ? <AdminHeader user={user} /> : <TeacherHeader user={user} />;
  const pageHeader = (
    <PageHeader
      back={{ href: role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard", label: "Back to Dashboard" }}
      icon={ClipboardList}
      iconClassName="text-averna-neon"
      title="Mock exam results"
      subtitle="Where each group stands after its full IELTS mocks, what to teach next and who is due a mock."
    />
  );

  if (!scope || !data) {
    return (
      <Shell header={header} pageHeader={pageHeader}>
        <div className="glass rounded-2xl border border-white/10">
          <EmptyState
            icon={AlertTriangle}
            accent="text-amber-300"
            title="Mock results couldn't be loaded"
            description="Something went wrong while reading the results. Please refresh the page in a moment."
          />
        </div>
      </Shell>
    );
  }

  if (scope.groups.length === 0) {
    return (
      <Shell header={header} pageHeader={pageHeader}>
        <div className="glass rounded-2xl border border-white/10">
          <EmptyState
            icon={Inbox}
            title="No groups yet"
            description={
              role === "ADMIN"
                ? "Create a group and add students to see their mock results here."
                : "Your students' mock results appear here once you teach a group."
            }
          />
        </div>
      </Shell>
    );
  }

  const all = !scope.group;
  const showGroup = all && scope.groups.length > 1;
  const scopeName = scope.group ? scope.group.name : role === "ADMIN" ? "All groups" : "All your groups";
  const exportHref = `/api/teacher/mock/export${scope.group ? `?group=${encodeURIComponent(scope.group.id)}` : ""}`;
  const { kpis, flags } = data;
  const target = kpis.target;

  return (
    <Shell header={header} pageHeader={pageHeader}>
      {/* Group selector + export */}
      <form
        method="get"
        action="/teacher/mock"
        aria-label="Choose a group"
        className="glass mb-3 flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="mock-group" className="mb-1 block text-xs font-medium text-gray-400">
            Group
          </label>
          <select id="mock-group" name="group" defaultValue={scope.group?.id ?? ""} className={SELECT}>
            <option value="" className="bg-averna-dark">
              {role === "ADMIN" ? "All groups" : "All my groups"}
            </option>
            {scope.groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-averna-dark">
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-averna-primary px-4 text-sm font-semibold text-white hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70"
        >
          <Filter className="h-4 w-4" aria-hidden />
          Show
        </button>
        {kpis.students > 0 && (
          <a
            href={exportHref}
            download
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-4 text-sm font-semibold text-gray-100 hover:border-averna-neon/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 sm:ml-auto"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
            <span className="sr-only"> of {scopeName}</span>
          </a>
        )}
      </form>
      <p className="mb-6 text-sm text-gray-400">
        <span className="font-medium text-gray-200">{scopeName}</span>
        {all && scope.groups.length > 1 ? ` · ${plural(scope.groups.length, "group")}` : ""} · {plural(kpis.students, "student")}
        {target !== null && (
          <>
            {" · "}group target <span className="font-medium text-gray-200">{formatBand(target)}</span>
            <span className="text-gray-500">
              {kpis.targetStudents === 1 ? " (one student's target)" : ` (average of ${kpis.targetStudents} students' targets)`}
            </span>
          </>
        )}
      </p>

      {scope.unknownGroup && (
        <p role="status" className={`${NOTICE} border-amber-300/30 bg-amber-400/10 text-amber-300`}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {role === "ADMIN"
            ? "That group couldn't be found, so every group is shown."
            : "That group isn't one of yours, so all your groups are shown."}
        </p>
      )}
      {(flags.resultsFailed || flags.partial) && (
        <p role="status" className={`${NOTICE} border-amber-300/30 bg-amber-400/10 text-amber-300`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {flags.resultsFailed
            ? "The section results couldn't be loaded — section bands, question types and criteria are missing below. Refresh to try again."
            : "Some details couldn't be loaded — question types or criteria may be incomplete. Refresh to try again."}
        </p>
      )}
      {(flags.studentsCapped || flags.attemptsCapped) && (
        <p className={`${NOTICE} border-white/10 bg-white/[0.03] text-gray-300`}>
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
          {[
            flags.studentsCapped ? "This view is limited to the first 600 students — choose a group to see everyone." : null,
            flags.attemptsCapped
              ? "Mock counts, best and latest bands are exact, but the trend and question types use the newest 5,000 mocks — choose a group for the full history."
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}

      {kpis.students === 0 ? (
        <div className="glass rounded-2xl border border-white/10">
          <EmptyState icon={Users} title="No students yet" description="Students assigned to this group will appear here." />
        </div>
      ) : (
        <>
          <MockKpiTiles kpis={kpis} />

          {kpis.withMock === 0 ? (
            <div className="glass mt-8 rounded-2xl border border-white/10">
              <EmptyState
                icon={ClipboardList}
                accent="text-averna-neon"
                title="No finished mocks yet"
                description="Students take the full mock from Learning → Mock exam. Results appear here as soon as the first one is finished."
              />
            </div>
          ) : (
            <>
              <section className="mt-10">
                <SectionHeader
                  icon={BarChart3}
                  title="Section averages"
                  subtitle={`Each student's latest mock${target !== null ? ` · marker: group target ${formatBand(target)}` : ""}`}
                  accent="text-averna-cyan"
                />
                <SectionAverages sections={data.sections} target={target} />
              </section>

              <section className="mt-10">
                <SectionHeader
                  icon={Lightbulb}
                  title="Question types to teach"
                  subtitle={`Reading & Listening · last ${MOCK_RULES.kindMocksPerStudent} mocks per student, past ${MOCK_RULES.kindWindowDays / 30} months`}
                  accent="text-amber-300"
                />
                <QuestionTypesPanel kinds={data.kinds} />
              </section>

              <section className="mt-10">
                <SectionHeader
                  icon={ListChecks}
                  title="Writing & Speaking criteria"
                  subtitle="Latest mocks · a teacher's review replaces the AI's bands"
                  accent="text-averna-pink"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <CriteriaCard skill="WRITING" block={data.criteria.writing} />
                  <CriteriaCard skill="SPEAKING" block={data.criteria.speaking} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Writing weighs Task 2 twice, as in the Writing band.
                  {data.criteria.capped ? ` Based on the ${MOCK_RULES.maxCriteriaMocks} most recent latest mocks.` : ""}
                </p>
              </section>

              <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-5">
                <section className="lg:col-span-2">
                  <SectionHeader icon={Layers} title="Band distribution" subtitle="Latest overall band" accent="text-averna-cyan" />
                  <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
                    <BandDistribution bins={data.distribution.bins} total={data.distribution.total} />
                  </div>
                </section>
                <section className="lg:col-span-3">
                  <SectionHeader
                    icon={TrendingUp}
                    title="Monthly trend"
                    subtitle={`Average overall · last ${MOCK_RULES.trendMonths} months`}
                    accent="text-averna-neon"
                  />
                  <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
                    {data.trend.points.length ? (
                      <TrendChart points={data.trend.points} change={data.trend.change} target={target} />
                    ) : (
                      <p className="text-sm text-gray-400">No mocks finished in the last {MOCK_RULES.trendMonths} months.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="mt-10">
                <SectionHeader
                  icon={Users}
                  title="Students"
                  subtitle="Sort by any column · dates open the mock, bands the section"
                  accent="text-averna-purple"
                />
                <MockStudentTable rows={data.students} showGroup={showGroup} caption={`Mock results of ${scopeName}`} />
              </section>
            </>
          )}

          <section className="mt-10">
            <SectionHeader icon={CalendarClock} title="Who needs a mock" accent="text-amber-300" />
            <NeedsMockPanel needs={data.needsMock} inProgress={data.inProgress} showGroup={showGroup} />
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ header, pageHeader, children }: { header: React.ReactNode; pageHeader: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        {header}
        {pageHeader}
        {children}
      </div>
    </div>
  );
}
