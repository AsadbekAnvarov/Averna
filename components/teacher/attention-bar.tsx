import Link from "next/link";
import { db } from "@/lib/db";
import { CheckSquare, AlertTriangle, MessageSquare, CheckCircle2 } from "lucide-react";

/**
 * "What needs your attention today" — a compact, scannable row of actionable
 * chips at the very top of the teacher dashboard. Each chip deep-links to where
 * the work happens. When everything is handled it shows a calm "all clear".
 */
export async function TeacherAttentionBar({ teacherId, userId }: { teacherId: string; userId: string }) {
  const [toGrade, unread, attendances] = await Promise.all([
    db.homeworkSubmission.count({ where: { status: "SUBMITTED", homework: { teacherId } } }),
    db.message.count({ where: { receiverId: userId, read: false } }),
    db.attendance.findMany({
      where: { group: { teacherId } },
      select: { studentId: true, status: true },
    }),
  ]);

  // Students whose attendance rate is below 70% (with at least 2 records)
  const byStudent = new Map<string, { present: number; total: number }>();
  for (const a of attendances) {
    const r = byStudent.get(a.studentId) ?? { present: 0, total: 0 };
    r.total += 1;
    if (a.status === "PRESENT" || a.status === "LATE") r.present += 1;
    byStudent.set(a.studentId, r);
  }
  let atRisk = 0;
  for (const r of byStudent.values()) {
    if (r.total >= 2 && r.present / r.total < 0.7) atRisk += 1;
  }

  const chips = [
    toGrade > 0 && {
      href: "/teacher/homework",
      icon: CheckSquare,
      label: `${toGrade} to grade`,
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:border-amber-400/60",
    },
    atRisk > 0 && {
      href: "/teacher/students",
      icon: AlertTriangle,
      label: `${atRisk} student${atRisk === 1 ? "" : "s"} at risk`,
      cls: "border-red-400/30 bg-red-400/10 text-red-300 hover:border-red-400/60",
    },
    unread > 0 && {
      href: "/messages",
      icon: MessageSquare,
      label: `${unread} new message${unread === 1 ? "" : "s"}`,
      cls: "border-averna-cyan/30 bg-averna-cyan/10 text-averna-cyan hover:border-averna-cyan/60",
    },
  ].filter(Boolean) as { href: string; icon: any; label: string; cls: string }[];

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-8">
      <span className="text-sm text-gray-400 font-medium">Needs attention:</span>
      {chips.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/10 text-averna-neon text-sm">
          <CheckCircle2 className="h-4 w-4" /> You&apos;re all caught up
        </span>
      ) : (
        chips.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${c.cls}`}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </Link>
          );
        })
      )}
    </div>
  );
}
