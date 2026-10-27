/**
 * Who a homework row is for. A row belongs to a group; `assigneeId` narrows it
 * to ONE student of that group (a teacher's one-button "mini task", idea 10 of
 * docs/elegance-roadmap.md). null = the whole group, as every row was before.
 *
 * Every student-facing homework read adds `forStudent(studentId)` to its
 * `where`, so a classmate's personal task never shows up in someone else's
 * list, calendar, Today session or Telegram reminder. Pure — no database.
 */

/** Prisma `where` fragment: whole-group homework, or homework set for this student alone. */
export function forStudent(studentId: string): { OR: [{ assigneeId: null }, { assigneeId: string }] } {
  return { OR: [{ assigneeId: null }, { assigneeId: studentId }] };
}

/** The same rule for a row already read (student pages, per-student report loops). */
export function isForStudent(h: { assigneeId?: string | null }, studentId: string): boolean {
  return !h.assigneeId || h.assigneeId === studentId;
}
