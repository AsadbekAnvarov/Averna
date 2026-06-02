import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function HomeworkPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
  });

  if (!student) redirect("/auth/signin");

  // Get upcoming homework
  const upcomingHomework = await db.homework.findMany({
    where: {
      groupId: student.groupId || "",
      dueDate: { gte: new Date() },
      submissions: { none: { studentId: student.id } },
    },
    orderBy: { dueDate: "asc" },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      submissions: true,
    },
  });

  // Get submitted homework
  const submittedHomework = await db.homeworkSubmission.findMany({
    where: { studentId: student.id },
    orderBy: { submittedAt: "desc" },
    take: 10,
    include: {
      homework: { include: { teacher: { include: { user: { select: { name: true } } } } } },
    },
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-purple-400" />
          Homework
        </h1>
        <p className="text-gray-300 mb-8">Submit first for bonus points! 🥇 1st: +10pts | 🥈 2nd: +8pts | 🥉 3rd: +6pts</p>

        {/* Upcoming Homework */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Pending ({upcomingHomework.length})</h2>
          {upcomingHomework.length === 0 ? (
            <Card className="glass border-averna-primary/30">
              <CardContent className="py-8 text-center text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending homework</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {upcomingHomework.map((hw) => {
                const submissionCount = hw.submissions.length;
                return (
                  <Card key={hw.id} className="glass border-purple-500/30 hover:shadow-neon-green transition-all">
                    <CardHeader>
                      <CardTitle className="text-lg">{hw.title}</CardTitle>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">{hw.module}</span>
                        <span className="text-gray-400">{'⭐'.repeat(hw.difficulty)}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-300 mb-4 line-clamp-2">{hw.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(hw.dueDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-averna-neon" />
                          {hw.points} pts
                        </span>
                      </div>
                      {submissionCount > 0 && (
                        <p className="text-xs text-yellow-400 mb-2">
                          ⚡ {submissionCount} submission{submissionCount !== 1 ? 's' : ''} already - hurry for bonus!
                        </p>
                      )}
                      <Link href={`/homework/${hw.id}`}>
                        <Button className="w-full neon-button bg-purple-500 hover:bg-purple-600">
                          Start Homework
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Submitted Homework */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Submitted ({submittedHomework.length})</h2>
          <div className="space-y-3">
            {submittedHomework.map((submission) => (
              <Card key={submission.id} className="glass border-averna-primary/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{submission.homework.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Submitted: {formatDate(submission.submittedAt)}</span>
                        {submission.position && (
                          <span className="text-averna-neon">Position: #{submission.position}</span>
                        )}
                        <span className="text-averna-neon">{submission.pointsAwarded} pts</span>
                      </div>
                      {submission.status === "GRADED" && submission.feedback && (
                        <p className="text-xs text-gray-400 mt-2">✓ Graded by teacher</p>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded text-xs font-semibold ${
                      submission.status === "GRADED" ? "bg-green-500/20 text-green-400" :
                      submission.status === "SUBMITTED" ? "bg-blue-500/20 text-blue-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {submission.status}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
