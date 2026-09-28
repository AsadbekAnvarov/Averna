import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyGroupStudents, TELEGRAM_BULK_BUDGET_MAX_MS } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";
import { resolveExamContent } from "@/lib/homework/library";
import { homeworkStaff } from "@/lib/homework/staff";

// Telegram copies of the "new homework" notice are sent after the response (lib/notifications) — give
// them time: up to 45 s of sending (TELEGRAM_BULK_BUDGET_MAX_MS, shared by the groups) fits inside these 60 s.
export const maxDuration = 60;

export const dynamic = "force-dynamic";

/**
 * POST — set homework for one or more of the teacher's groups (one Homework
 * row per group; every student of each group is notified).
 *
 * Classic:  { title, description, module, difficulty, points, dueDate, groupIds }
 * Library:  { contentKind, contentId, contentPart?, (WRITING_EXAM: task1Id, task2Id),
 *             title?, description?, difficulty?, points, dueDate, groupIds }
 *
 * Library content is validated against the catalog; module and contentTitle
 * come from the content, never from the client. `groupIds` may be "all".
 * `dueDate` is an ISO timestamp (a bare "YYYY-MM-DDTHH:mm" is read as Tashkent time).
 */

const MODULES = ["WRITING", "READING", "LISTENING", "SPEAKING"] as const;
type Module = (typeof MODULES)[number];
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const DAY = 86_400_000;

interface HomeworkData {
  title: string;
  description: string;
  module: Module;
  difficulty: number;
  points: number;
  dueDate: Date;
  teacherId: string;
  contentKind?: string;
  contentId?: string;
  contentPart?: number | null;
  contentTitle?: string;
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function text(x: unknown, max: number): string {
  return typeof x === "string" ? x.trim().slice(0, max) : "";
}

function int(x: unknown, min: number, max: number, fallback: number): number {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function parseDue(x: unknown): Date | null {
  if (typeof x !== "string" || !x.trim()) return null;
  const s = x.trim();
  const d = new Date(LOCAL_DATETIME.test(s) ? `${s.length === 16 ? `${s}:00` : s}+05:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const staff = await homeworkStaff();
  if (!staff.ok) return staff.response;
  const teacherId = staff.teacherId;
  if (!teacherId) return bad("This account has no teacher profile, so it has no groups to set homework for.", 403);

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return bad("Invalid request.");

    // --- Groups: only the teacher's own; one Homework row per chosen group.
    const groups: { id: string }[] = await db.group.findMany({
      where: { teacherId },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    if (!groups.length) return bad("You have no groups yet — ask an admin to assign you a group.");
    const own = new Set(groups.map((g) => g.id));
    let groupIds: string[];
    if (body.groupIds === "all") {
      groupIds = groups.map((g) => g.id);
    } else if (Array.isArray(body.groupIds) || typeof body.groupId === "string") {
      const asked = Array.isArray(body.groupIds) ? body.groupIds : [body.groupId];
      groupIds = Array.from(new Set(asked.filter((x): x is string => typeof x === "string" && x.length > 0)));
      if (groupIds.some((id) => !own.has(id))) return bad("You can only set homework for your own groups.", 403);
    } else {
      groupIds = groups.length === 1 ? [groups[0].id] : [];
    }
    if (!groupIds.length) return bad("Choose at least one group.");

    // --- Shared fields.
    const due = parseDue(body.dueDate);
    if (!due) return bad("Set a due date.");
    if (due.getTime() < Date.now() - 60_000) return bad("That due date has already passed — choose a time in the future.");
    if (due.getTime() > Date.now() + 366 * DAY) return bad("Choose a due date within the next year.");
    const points = int(body.points, 10, 200, 50);

    let data: HomeworkData;
    if (body.contentKind != null && body.contentKind !== "") {
      // --- From the test library.
      const resolved = await resolveExamContent(body);
      if (!resolved.ok) return bad(resolved.error);
      const c = resolved.content;
      data = {
        title: text(body.title, 200) || c.title,
        description: text(body.description, 5000) || c.description,
        module: c.module,
        difficulty: int(body.difficulty, 1, 5, c.difficulty ?? 2),
        points,
        dueDate: due,
        teacherId,
        contentKind: c.kind,
        contentId: c.contentId,
        contentPart: c.contentPart,
        contentTitle: c.contentTitle,
      };
    } else {
      // --- Classic free-text homework.
      const title = text(body.title, 200);
      const description = text(body.description, 20000);
      if (!title || !description) return bad("Add a title and instructions.");
      const module = MODULES.find((m) => m === body.module);
      if (!module) return bad("Choose a module.");
      data = { title, description, module, difficulty: int(body.difficulty, 1, 5, 2), points, dueDate: due, teacherId };
    }

    const created: { id: string; groupId: string }[] = await db.$transaction(
      groupIds.map((groupId) => db.homework.create({ data: { ...data, groupId }, select: { id: true, groupId: true } }))
    );

    const message = `${data.title} — due ${formatDateTime(due)}`;
    await Promise.all(
      created.map((h) =>
        notifyGroupStudents(
          h.groupId,
          { type: "homework", title: "New homework assigned", message, link: `/homework/${h.id}` },
          { telegramBudgetMs: TELEGRAM_BULK_BUDGET_MAX_MS }
        )
      )
    );

    return NextResponse.json({
      success: true,
      homeworkId: created[0]?.id,
      homeworkIds: created.map((h) => h.id),
      groups: created.length,
    });
  } catch (error: unknown) {
    console.error("Homework creation error:", error);
    return bad("The homework couldn't be created. Please try again.", 500);
  }
}
