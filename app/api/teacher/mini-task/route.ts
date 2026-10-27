import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewStudent, teacherOf } from "@/lib/access";
import { resolveExamContent } from "@/lib/homework/library";
import { createHomework, parseDue } from "@/lib/homework/create";
import { PRACTICE_KIND_LABEL } from "@/lib/ielts/format";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { loadMiniTask } from "@/lib/teacher/mini-task-load";
import { needsHelpTag } from "@/lib/teacher/needs-help-tag";

export const dynamic = "force-dynamic";

/**
 * One-button mini task (docs/elegance-roadmap.md, idea 10). Teachers only, for
 * a student of their own groups (lib/access `canReviewStudent`).
 *
 *   GET  ?studentId=…  → { task } — the preview: one Reading / Listening part
 *                        aimed at the student's weakest question type (or null).
 *   POST { studentId, contentKind, contentId, contentPart, kind?, title, dueDate }
 *        → { ok, homeworkId } — a Homework row for that student alone, made by
 *          the same path as "Set homework" (lib/homework/create): it shows up in
 *          their homework, Today session and calendar, and they are notified.
 */
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const KINDS = Object.keys(PRACTICE_KIND_LABEL) as [string, ...string[]];
const assignSchema = z.object({
  studentId: ID,
  contentKind: z.enum(["READING", "LISTENING"]),
  contentId: z.string().min(1).max(200),
  contentPart: z.number().int().min(0).max(19).nullable(),
  kind: z.enum(KINDS).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  dueDate: z.string().min(10).max(40),
});

const DAY = 86_400_000;
const MAX_DUE_DAYS = 60;
const MINI_TASK_POINTS = 20;

type Teacher = { userId: string; teacherId: string };

async function teacherSession(): Promise<Teacher | NextResponse> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return reply({ error: "Sign in again to set a mini task." }, 401);
  if (user.role !== "TEACHER") return reply({ error: "Mini tasks are for teachers." }, 403);
  const teacher = await teacherOf(user.id);
  if (!teacher) return reply({ error: "This account has no teacher profile." }, 403);
  return { userId: user.id, teacherId: teacher.id };
}

export async function GET(request: Request) {
  const t = await teacherSession();
  if (t instanceof NextResponse) return t;
  const studentId = new URL(request.url).searchParams.get("studentId") ?? "";
  if (!ID.safeParse(studentId).success) return reply({ error: "Invalid student." }, 400);
  if (!(await canReviewStudent({ id: t.userId, role: "TEACHER" }, studentId))) {
    return reply({ error: "You can only set tasks for students in your own groups." }, 403);
  }
  try {
    const task = await loadMiniTask(studentId);
    return reply({ task });
  } catch (e) {
    console.error("Mini task preview failed:", e instanceof Error ? e.message : e);
    return reply({ error: "The mini task couldn't be prepared. Try again in a moment." }, 500);
  }
}

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  const t = await teacherSession();
  if (t instanceof NextResponse) return t;

  let raw: unknown;
  try {
    raw = await boundedJson(request, 8_000);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "Check the task's title and due date." }, 400);
  const b = parsed.data;

  if (!(await canReviewStudent({ id: t.userId, role: "TEACHER" }, b.studentId))) {
    return reply({ error: "You can only set tasks for students in your own groups." }, 403);
  }
  const due = parseDue(b.dueDate);
  if (!due) return reply({ error: "Set a due date." }, 400);
  if (due.getTime() < Date.now() - 60_000) return reply({ error: "That due date has already passed — choose a later one." }, 400);
  if (due.getTime() > Date.now() + MAX_DUE_DAYS * DAY) return reply({ error: `Choose a due date within ${MAX_DUE_DAYS} days.` }, 400);

  try {
    const student: { id: string; userId: string; groupId: string | null } | null = await db.student.findUnique({
      where: { id: b.studentId },
      select: { id: true, userId: true, groupId: true },
    });
    if (!student?.groupId) return reply({ error: "This student isn't in a group." }, 400);

    const resolved = await resolveExamContent({ contentKind: b.contentKind, contentId: b.contentId, contentPart: b.contentPart });
    if (!resolved.ok) return reply({ error: resolved.error }, 400);
    const c = resolved.content;
    const label = b.kind ? PRACTICE_KIND_LABEL[b.kind as keyof typeof PRACTICE_KIND_LABEL] : null;
    const intro = label
      ? `A short practice task from your teacher, picked for ${label.toLowerCase()} questions.`
      : "A short practice task from your teacher.";

    const [created] = await createHomework(
      {
        title: b.title,
        description: `${intro}\n\n${c.description}`,
        module: c.module,
        difficulty: c.difficulty ?? 2,
        points: MINI_TASK_POINTS,
        dueDate: due,
        teacherId: t.teacherId,
        contentKind: c.kind,
        contentId: c.contentId,
        contentPart: c.contentPart,
        contentTitle: c.contentTitle,
      },
      [student.groupId],
      { studentId: student.id, userId: student.userId }
    );
    revalidateTag(needsHelpTag(t.teacherId));
    return reply({ ok: true, homeworkId: created?.id ?? null });
  } catch (e) {
    console.error("Mini task assign failed:", e instanceof Error ? e.message : e);
    return reply({ error: "The task couldn't be set. Nothing was assigned — please try again." }, 500);
  }
}
