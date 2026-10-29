import { db } from "@/lib/db";
import { getLevelInfo } from "@/lib/utils";
import { StudentOfTheWeekCard } from "@/components/student-of-the-week-card";

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
  return <StudentOfTheWeekCard name={student.user.name} image={student.user.image}
    level={lvl.level} title={lvl.title} points={weeklyPoints} weekly={!!topStudentId} />;
}
