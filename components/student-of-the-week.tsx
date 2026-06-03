import { Card, CardContent } from "@/components/ui/card";
import { Crown } from "lucide-react";
import { db } from "@/lib/db";
import { getLevelInfo } from "@/lib/utils";

/**
 * Highlights the student who earned the most points over the last 7 days.
 * Falls back to the all-time top student if there's no recent activity.
 */
export async function StudentOfTheWeek() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  let topStudentId: string | null = null;
  let weeklyPoints = 0;

  try {
    const grouped = await db.activityLog.groupBy({
      by: ["studentId"],
      where: { createdAt: { gte: since }, points: { gt: 0 } },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 1,
    });
    if (grouped.length > 0) {
      topStudentId = grouped[0].studentId;
      weeklyPoints = grouped[0]._sum.points ?? 0;
    }
  } catch {
    topStudentId = null;
  }

  let student =
    topStudentId
      ? await db.student.findUnique({
          where: { id: topStudentId },
          include: { user: { select: { name: true, image: true } } },
        })
      : null;

  if (!student) {
    student = await db.student.findFirst({
      orderBy: { totalPoints: "desc" },
      include: { user: { select: { name: true, image: true } } },
    });
    weeklyPoints = student?.totalPoints ?? 0;
  }

  if (!student) return null;

  const lvl = getLevelInfo(student.totalPoints);
  const initials = (student.user.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="glass border-yellow-400/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent" />
      <CardContent className="relative py-5">
        <div className="flex items-center gap-2 text-yellow-400 mb-3">
          <Crown className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Student of the Week</span>
        </div>
        <div className="flex items-center gap-3">
          {student.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.user.image} alt={student.user.name ?? "student"} className="h-14 w-14 rounded-full object-cover border-2 border-yellow-400/60" />
          ) : (
            <div className="h-14 w-14 rounded-full flex items-center justify-center font-bold text-white bg-yellow-500/30 border-2 border-yellow-400/60">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-bold truncate">{student.user.name ?? "Student"} 🏆</p>
            <p className="text-xs text-averna-cyan">Lvl {lvl.level} · {lvl.title}</p>
            <p className="text-xs text-yellow-300 font-semibold mt-0.5">+{weeklyPoints} pts this week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
