import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, ArrowRight, PenTool, BookOpen, Headphones, Mic } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

const MODULE_ICON: Record<string, any> = {
  WRITING: PenTool,
  READING: BookOpen,
  LISTENING: Headphones,
  SPEAKING: Mic,
};

const MODULE_COLOR: Record<string, string> = {
  WRITING: "bg-averna-purple/15 text-averna-purple",
  READING: "bg-averna-cyan/15 text-averna-cyan",
  LISTENING: "bg-averna-pink/15 text-averna-pink",
  SPEAKING: "bg-amber-400/15 text-amber-400",
};

/**
 * "Needs grading" inbox — the most recent ungraded submissions across all of
 * the teacher's homework, with a one-click jump to the grading hub.
 */
export async function GradingInbox({ teacherId }: { teacherId: string }) {
  const submissions = await db.homeworkSubmission.findMany({
    where: { status: "SUBMITTED", homework: { teacherId } },
    include: {
      student: { include: { user: { select: { name: true } } } },
      homework: { select: { title: true, module: true, group: { select: { name: true } } } },
    },
    orderBy: { submittedAt: "asc" }, // oldest first — grade these first
    take: 6,
  });

  const total = await db.homeworkSubmission.count({
    where: { status: "SUBMITTED", homework: { teacherId } },
  });

  return (
    <Card className="glass border-amber-400/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <CheckSquare className="h-5 w-5" /> Needs Grading
          </span>
          <span className="text-sm font-normal text-gray-400">{total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-sm text-averna-neon py-2">✓ All caught up — nothing waiting to be graded!</p>
        ) : (
          <>
            <div className="space-y-2">
              {submissions.map((s) => {
                const Icon = MODULE_ICON[s.homework.module] ?? CheckSquare;
                const color = MODULE_COLOR[s.homework.module] ?? "bg-white/10 text-gray-300";
                return (
                  <Link
                    key={s.id}
                    href="/teacher/homework"
                    className="group flex items-center gap-3 p-3 rounded-lg bg-amber-400/5 border border-amber-400/15 hover:border-amber-400/40 transition-colors"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">
                        {s.student.user.name ?? "Student"}
                        <span className="text-gray-500 font-normal"> · {s.homework.title}</span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {s.homework.group.name} · submitted {timeAgo(s.submittedAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-500 shrink-0 group-hover:translate-x-0.5 group-hover:text-amber-400 transition-all" />
                  </Link>
                );
              })}
            </div>
            {total > submissions.length && (
              <Link
                href="/teacher/homework"
                className="mt-3 inline-flex items-center gap-1 text-sm text-amber-400 hover:underline"
              >
                View all {total} submissions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
