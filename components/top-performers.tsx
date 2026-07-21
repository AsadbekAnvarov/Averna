import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLevelInfo, initialsOf } from "@/lib/utils";
import { Trophy, GraduationCap } from "lucide-react";

const MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({
  name,
  image,
  ring,
}: {
  name: string | null;
  image: string | null;
  ring: string;
}) {
  const initials = initialsOf(name);
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={name ?? "user"}
        className={`h-14 w-14 rounded-full object-cover border-2 ${ring}`}
      />
    );
  }
  return (
    <div
      className={`h-14 w-14 rounded-full flex items-center justify-center font-bold text-white bg-averna-primary/40 border-2 ${ring}`}
    >
      {initials}
    </div>
  );
}

export async function TopPerformers() {
  const topStudents = await db.student.findMany({
    orderBy: { totalPoints: "desc" },
    take: 3,
    include: { user: { select: { name: true, image: true } } },
  });

  const teachers = await db.teacher.findMany({
    include: {
      user: { select: { name: true, image: true } },
      groups: { include: { students: true } },
    },
  });

  const topTeachers = teachers
    .map((t) => ({
      ...t,
      studentCount: t.groups.reduce((s, g) => s + g.students.length, 0),
    }))
    .sort((a, b) => b.studentCount - a.studentCount)
    .slice(0, 3);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Top Students */}
      <Card className="glass border-averna-neon/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-neon">
            <Trophy className="h-5 w-5" />
            Top 3 Students
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topStudents.length === 0 && (
            <p className="text-gray-400 text-sm">No students yet.</p>
          )}
          {topStudents.map((s, i) => {
            const lvl = getLevelInfo(s.totalPoints);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <span className="text-2xl w-7 text-center">{MEDALS[i] ?? i + 1}</span>
                <Avatar name={s.user.name} image={s.user.image} ring="border-averna-neon/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold truncate">
                    {s.user.name ?? "Student"}
                  </p>
                  <p className="text-xs text-averna-cyan">
                    Lvl {lvl.level} · {lvl.title}
                  </p>
                </div>
                <span className="text-averna-neon font-bold whitespace-nowrap">
                  {s.totalPoints} pts
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Top Teachers */}
      <Card className="glass border-averna-purple/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-purple">
            <GraduationCap className="h-5 w-5" />
            Top 3 Teachers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topTeachers.length === 0 && (
            <p className="text-gray-400 text-sm">No teachers yet.</p>
          )}
          {topTeachers.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <span className="text-2xl w-7 text-center">{MEDALS[i] ?? i + 1}</span>
              <Avatar name={t.user.name} image={t.user.image} ring="border-averna-purple/50" />
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold truncate">
                  {t.user.name ?? "Teacher"}
                  {t.isSecondTeacher && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-averna-pink/20 text-averna-pink align-middle">
                      1-on-1
                    </span>
                  )}
                </p>
                <p className="text-xs text-averna-cyan truncate">
                  {t.specialty ?? "IELTS Instructor"}
                </p>
              </div>
              <span className="text-averna-purple font-bold whitespace-nowrap">
                {t.studentCount} 👥
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
