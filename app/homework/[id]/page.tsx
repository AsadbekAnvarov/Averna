export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import HomeworkSubmissionForm from "@/components/homework/submission-form";

export default async function HomeworkDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) redirect("/auth/signin");

  const homework = await db.homework.findUnique({
    where: { id: params.id },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      submissions: { select: { studentId: true } },
    },
  });

  if (!homework) redirect("/homework");

  // Check if already submitted
  const existingSubmission = await db.homeworkSubmission.findUnique({
    where: { studentId_homeworkId: { studentId: student.id, homeworkId: homework.id } },
  });

  if (existingSubmission) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold mb-4">Already Submitted! ✓</h1>
            <p className="text-gray-300 mb-6">You've already submitted this homework.</p>
            <a href="/homework" className="text-averna-neon hover:underline">
              ← Back to Homework
            </a>
          </div>
        </div>
      </div>
    );
  }

  const submissionCount = homework.submissions.length;

  return <HomeworkSubmissionForm homework={homework} studentId={student.id} submissionCount={submissionCount} />;
}
