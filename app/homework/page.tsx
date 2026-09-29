export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { examHomeworkHref, isExamHomeworkKind } from "@/lib/homework/exam-homework";
import { describeExamHomework } from "@/lib/homework/library";
import { reviewedTestIds } from "@/lib/homework/reviews";
import { dueState, examResultHref } from "@/lib/homework/library-shared";
import { DoneCard, TodoCard, type DoneHomework, type ExamFacts } from "@/components/homework/homework-cards";

/** Overdue homework stays on the to-do list this long (it can still be handed in late). */
const OVERDUE_DAYS = 30;

interface TodoRow {
  id: string;
  title: string;
  description: string;
  module: string;
  difficulty: number;
  points: number;
  dueDate: Date;
  contentKind: string | null;
  contentId: string | null;
  contentPart: number | null;
  contentTitle: string | null;
  _count?: { submissions: number };
}

interface DoneRow {
  id: string;
  status: string;
  position: number | null;
  pointsAwarded: number;
  feedback: string | null;
  band: number | null;
  testId: string | null;
  submittedAt: Date;
  homework: {
    id: string;
    title: string;
    module: string;
    dueDate: Date;
    contentKind: string | null;
    contentPart: number | null;
  } | null;
}

export default async function HomeworkPage() {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student: { id: string; groupId: string | null } | null = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!student) return redirect("/auth/signin");

  const since = new Date(Date.now() - OVERDUE_DAYS * 86_400_000);
  const [todo, done]: [TodoRow[], DoneRow[]] = await Promise.all([
    student.groupId
      ? db.homework.findMany({
          where: { groupId: student.groupId, dueDate: { gte: since }, submissions: { none: { studentId: student.id } } },
          orderBy: { dueDate: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            module: true,
            difficulty: true,
            points: true,
            dueDate: true,
            contentKind: true,
            contentId: true,
            contentPart: true,
            contentTitle: true,
            _count: { select: { submissions: true } },
          },
        })
      : Promise.resolve([]),
    db.homeworkSubmission.findMany({
      where: { studentId: student.id },
      orderBy: { submittedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        position: true,
        pointsAwarded: true,
        feedback: true,
        band: true,
        testId: true,
        submittedAt: true,
        homework: { select: { id: true, title: true, module: true, dueDate: true, contentKind: true, contentPart: true } },
      },
    }),
  ]);

  const facts = await Promise.all(
    todo.map((h): Promise<ExamFacts | null> => (isExamHomeworkKind(h.contentKind) ? describeExamHomework(h) : Promise.resolve(null)))
  );

  // Writing / Speaking homework the teacher has reviewed (the reviewed band is already on the submission).
  const reviewed = await reviewedTestIds(done.map((d) => ({ kind: d.homework?.contentKind ?? null, testId: d.testId })));

  const overdue = todo.filter((h) => dueState(h.dueDate).overdue).length;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        <Link href="/dashboard" className="mb-4 block text-sm text-averna-neon hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
          <BookOpen className="h-8 w-8 text-purple-400 sm:h-10 sm:w-10" aria-hidden />
          Homework
        </h1>
        <p className="mb-8 text-gray-300">Submit first for bonus points! 🥇 1st: +10pts | 🥈 2nd: +8pts | 🥉 3rd: +6pts</p>

        <section className="mb-10" aria-labelledby="hw-todo">
          <h2 id="hw-todo" className="mb-4 text-2xl font-bold text-white">
            To do ({todo.length})
            {overdue > 0 && <span className="ml-2 align-middle text-sm font-medium text-red-300">· {overdue} overdue</span>}
          </h2>
          {todo.length === 0 ? (
            <Card className="glass border-averna-primary/30">
              <CardContent className="py-2">
                <EmptyState
                  icon={CheckCircle2}
                  title="You're all caught up!"
                  description="No pending homework right now. New assignments from your teacher will appear here."
                  accent="text-averna-neon"
                  action={{ label: "Practise in the Learning Center", href: "/learning" }}
                />
              </CardContent>
            </Card>
          ) : (
            <ul role="list" className="grid gap-4 md:grid-cols-2">
              {todo.map((hw, i) => (
                <li key={hw.id}>
                  <TodoCard
                    hw={{ ...hw, submissionCount: hw._count?.submissions ?? 0 }}
                    exam={facts[i]}
                    startHref={examHomeworkHref(hw)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="hw-done">
          <h2 id="hw-done" className="mb-4 text-2xl font-bold text-white">
            Done ({done.length})
          </h2>
          {done.length === 0 ? (
            <Card className="glass border-averna-primary/30">
              <CardContent className="py-2">
                <EmptyState
                  icon={Trophy}
                  title="Nothing submitted yet"
                  description="Complete a pending assignment to earn points — submit early for a bonus!"
                  accent="text-averna-cyan"
                />
              </CardContent>
            </Card>
          ) : (
            <ul role="list" className="space-y-3">
              {done
                .filter((d) => d.homework)
                .map((d) => {
                  const hw = d.homework as NonNullable<DoneRow["homework"]>;
                  const kind = isExamHomeworkKind(hw.contentKind) ? hw.contentKind : null;
                  const row: DoneHomework = {
                    submissionId: d.id,
                    homeworkId: hw.id,
                    title: hw.title,
                    module: hw.module,
                    contentKind: hw.contentKind,
                    contentPart: hw.contentPart,
                    dueDate: hw.dueDate,
                    submittedAt: d.submittedAt,
                    status: d.status,
                    position: d.position,
                    pointsAwarded: d.pointsAwarded,
                    feedback: d.feedback,
                    band: d.band,
                    testId: d.testId,
                    reviewed: !!d.testId && reviewed.has(d.testId),
                  };
                  return (
                    <li key={d.id}>
                      <DoneCard d={row} resultHref={kind && d.testId ? examResultHref(kind, d.testId) : null} />
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
