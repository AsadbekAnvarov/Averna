export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Flag, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { visibleStudentIds } from "@/lib/access";
import { FORMAT_INFO } from "@/lib/speaking/formats";
import { isPeerFormat } from "@/lib/speaking/matching";
import { loadPeerMonitor, type MonitorPerson, type PeerMonitorData } from "@/lib/speaking/teacher-monitor";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PeerReportResolve } from "@/components/teacher/peer-report-resolve";

export const metadata = { title: "Peer speaking" };

const OUTCOME = { completed: "Completed", "ended-early": "Ended early", active: "In progress" } as const;

const when = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(ms),
  );

const who = (p: MonitorPerson) => (p.group ? `${p.name} (${p.group})` : p.name);
const rating = (x: number | null) => (x === null ? "—" : `${x.toFixed(1)}/5`);

/**
 * Teacher monitor for peer speaking (docs/peer-speaking.md, Phase C): this week's sessions
 * of the teacher's groups (admins: all), open reports with Resolve, and a summary.
 * Shared with admins, so it stays in English like the rest of /teacher/**.
 */
export default async function TeacherSpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN") redirect("/learning/speaking");
  const user = { name: session.user.name ?? (role === "ADMIN" ? "Admin" : "Teacher"), email: session.user.email ?? "" };

  const scope = await visibleStudentIds({ id: session.user.id, role });
  const data: PeerMonitorData | null = await loadPeerMonitor(scope).catch(() => null);

  const stats = data
    ? [
        { label: "Sessions this week", value: String(data.summary.sessions) },
        { label: "Students", value: String(data.summary.students) },
        { label: "Avg session length", value: data.summary.avgMinutes === null ? "—" : `${data.summary.avgMinutes} min` },
        { label: "Students paused", value: String(data.summary.paused) },
      ]
    : [];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-4 pb-8 sm:py-6 lg:pb-6">
        {role === "ADMIN" ? <AdminHeader user={user} /> : <TeacherHeader user={user} />}
        <PageHeader
          back={{ href: role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={Users}
          iconClassName="text-averna-pink"
          title="Peer speaking"
          subtitle={role === "ADMIN" ? "1-on-1 practice sessions between students — all groups." : "1-on-1 practice sessions of your groups' students."}
        />

        {!data ? (
          <div className="av-panel rounded-2xl p-6 text-sm text-gray-300" role="alert">
            Peer speaking data is unavailable right now. Try again in a minute.
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="av-panel rounded-2xl p-4">
                  <dt className="text-xs text-gray-400">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-white">{s.value}</dd>
                </div>
              ))}
            </dl>

            <section aria-labelledby="peer-reports-title" className="av-panel rounded-2xl p-4 sm:p-5">
              <h2 id="peer-reports-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                <Flag className="h-5 w-5 text-averna-pink" aria-hidden /> Open reports
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Two open reports pause a student&apos;s peer speaking. Resolving a report lowers the count; below two, they can practise again.
              </p>
              {data.reports.length === 0 ? (
                <p className="mt-3 text-sm text-gray-300">No open reports.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.reports.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 p-3">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold text-white">{r.reasonLabel}</p>
                        <p className="text-gray-300">
                          {who(r.reporter)} reported {who(r.reported)} · {when(r.at)}
                        </p>
                        {r.note && <p className="mt-1 whitespace-pre-wrap text-gray-200">“{r.note}”</p>}
                        {r.paused && (
                          <p className="mt-1 text-xs font-semibold text-yellow-300">
                            {r.reported.name} is paused ({r.openAboutReported} open reports)
                          </p>
                        )}
                      </div>
                      <PeerReportResolve reportId={r.id} unpauses={r.unpausesOnResolve} name={r.reported.name} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="peer-sessions-title" className="av-panel rounded-2xl p-4 sm:p-5">
              <h2 id="peer-sessions-title" className="text-lg font-semibold text-white">
                This week&apos;s sessions
              </h2>
              {data.sessions.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No sessions this week"
                  description="Peer speaking sessions of your groups will appear here"
                  action={{ label: "Open the Speaking hub", href: "/learning/speaking" }}
                />
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <caption className="sr-only">Peer speaking sessions this week</caption>
                    <thead className="text-xs text-gray-400">
                      <tr>
                        <th scope="col" className="py-2 pr-3 font-medium">When</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Students</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Format</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Length</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Result</th>
                        <th scope="col" className="py-2 font-medium">Peer ratings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sessions.map((s) => (
                        <tr key={s.id} className="border-t border-white/10 align-top text-gray-200">
                          <td className="py-2 pr-3 whitespace-nowrap">{when(s.at)}</td>
                          <td className="py-2 pr-3">
                            {who(s.a)}
                            <br />
                            {who(s.b)}
                          </td>
                          <td className="py-2 pr-3">{isPeerFormat(s.format) ? FORMAT_INFO[s.format].title : s.format}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{s.minutes === null ? "—" : `${s.minutes} min`}</td>
                          <td className="py-2 pr-3">{OUTCOME[s.outcome]}</td>
                          <td className="py-2 text-xs">
                            {s.a.name} → {s.b.name}: {rating(s.ratingAtoB)}
                            <br />
                            {s.b.name} → {s.a.name}: {rating(s.ratingBtoA)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
