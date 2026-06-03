export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      groups: {
        include: {
          students: {
            include: { user: { select: { name: true, email: true } } },
            orderBy: { totalPoints: "desc" },
          },
        },
      },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile. Sign in with a teacher account to view students."
      />
    );
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <Link
          href="/teacher/dashboard"
          className="text-averna-neon hover:underline text-sm mb-4 block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <Users className="h-8 w-8 text-averna-cyan" />
          My Students
        </h1>

        {teacher.groups.length === 0 && (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-300">
              No groups assigned yet.
            </CardContent>
          </Card>
        )}

        <div className="space-y-8">
          {teacher.groups.map((group) => (
            <Card key={group.id} className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="text-averna-cyan">
                  {group.name}{" "}
                  <span className="text-sm text-gray-400">
                    ({group.students.length} students)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.students.length === 0 ? (
                  <p className="text-gray-400 text-sm">No students in this group yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-gray-400 text-sm border-b border-white/10">
                          <th className="py-2 pr-4">#</th>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Points</th>
                          <th className="py-2 pr-4">Streak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((student, idx) => (
                          <tr
                            key={student.id}
                            className="border-b border-white/5 hover:bg-white/5"
                          >
                            <td className="py-2 pr-4 text-gray-400">{idx + 1}</td>
                            <td className="py-2 pr-4 text-white font-medium">
                              {student.user.name ?? "Unnamed"}
                            </td>
                            <td className="py-2 pr-4 text-gray-300">{student.user.email}</td>
                            <td className="py-2 pr-4 text-averna-neon font-semibold">
                              {student.totalPoints}
                            </td>
                            <td className="py-2 pr-4 text-averna-pink">
                              {student.currentStreak}🔥
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
