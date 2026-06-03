export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function TeacherHomeworkPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") redirect("/auth/signin");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      homework: {
        include: {
          group: true,
          submissions: { include: { student: { include: { user: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!teacher) redirect("/auth/signin");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/teacher/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-8">Homework Management</h1>

        <div className="space-y-6">
          {teacher.homework.map(hw => {
            const pendingCount = hw.submissions.filter(s => s.status === "SUBMITTED").length;
            return (
              <Card key={hw.id} className="glass border-purple-500/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{hw.title}</CardTitle>
                      <p className="text-sm text-gray-400 mt-1">{hw.group.name}</p>
                    </div>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">
                      {hw.module}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-400">
                      <p>Due: {formatDate(hw.dueDate)}</p>
                      <p>Submissions: {hw.submissions.length}</p>
                      {pendingCount > 0 && (
                        <p className="text-yellow-400 font-semibold">
                          ⚠️ {pendingCount} pending grading
                        </p>
                      )}
                    </div>
                  </div>

                  {hw.submissions.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {hw.submissions.slice(0, 3).map(sub => (
                        <div key={sub.id} className="p-2 bg-averna-dark/30 rounded text-sm flex justify-between">
                          <span className="text-white">{sub.student.user.name}</span>
                          <span className={`${
                            sub.status === "GRADED" ? "text-green-400" : "text-yellow-400"
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
