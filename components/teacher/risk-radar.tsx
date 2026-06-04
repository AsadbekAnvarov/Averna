import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";

/**
 * Highlights students who may need attention: low recent activity,
 * poor attendance, or blacklisted. Helps teachers act early.
 */
export async function RiskRadar({ teacherId }: { teacherId: string }) {
  const groups = await db.group.findMany({
    where: { teacherId },
    include: {
      students: {
        include: {
          user: { select: { name: true } },
          attendances: { orderBy: { date: "desc" }, take: 8 },
          activityLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const now = Date.now();
  const atRisk: { id: string; name: string; reasons: string[] }[] = [];

  for (const g of groups) {
    for (const s of g.students) {
      const reasons: string[] = [];

      // Attendance rate
      if (s.attendances.length >= 3) {
        const present = s.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
        const rate = Math.round((present / s.attendances.length) * 100);
        if (rate < 60) reasons.push(`Low attendance (${rate}%)`);
      }

      // Inactivity
      const last = s.activityLogs[0]?.createdAt;
      if (last) {
        const days = Math.floor((now - new Date(last).getTime()) / 86400000);
        if (days >= 5) reasons.push(`Inactive ${days} days`);
      } else {
        reasons.push("No activity yet");
      }

      // Blacklist
      if (s.blacklisted) reasons.push("Blacklisted");

      if (reasons.length > 0) {
        atRisk.push({ id: s.id, name: s.user.name ?? "Student", reasons });
      }
    }
  }

  // Sort by number of risk reasons (most urgent first)
  atRisk.sort((a, b) => b.reasons.length - a.reasons.length);

  return (
    <Card className="glass border-yellow-500/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="h-5 w-5" /> Students Who Need Help
          </span>
          <span className="text-sm font-normal text-gray-400">{atRisk.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {atRisk.length === 0 ? (
          <p className="text-sm text-averna-neon">🎉 Everyone&apos;s on track — no students at risk right now!</p>
        ) : (
          <div className="space-y-2">
            {atRisk.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                href={`/teacher/parent-report/${s.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{s.name}</p>
                  <p className="text-xs text-yellow-300/90 truncate">{s.reasons.join(" · ")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
