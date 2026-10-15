import { z } from "zod";
/** Client-observed visibility only; never evidence sufficient for a penalty. */
export const mockFocusBatch = z.object({ events: z.array(z.object({
  eventId: z.string().uuid(), kind: z.enum(["monitor", "hidden"]), section: z.number().int().min(0).max(2),
  leftAt: z.string().datetime(), returnedAt: z.string().datetime().nullable(),
}).strict()).min(1).max(16) }).strict();
export function validFocusTimes(e: { leftAt: string; returnedAt: string | null; kind: string }, startedAt: Date, end: Date | null, now: number) {
  const left = Date.parse(e.leftAt), returned = e.returnedAt ? Date.parse(e.returnedAt) : null;
  return left >= startedAt.getTime() - 5000 && left <= now + 5000 &&
    (!end || left <= end.getTime()) && (!end || now - end.getTime() < 86400000) &&
    (returned === null || (returned >= left && returned <= now + 5000)) &&
    (e.kind !== "monitor" || returned === null);
}
export const focusDuration = (left: Date, returned: Date, end: Date | null) => Math.min(86400000, Math.max(0, Math.min(returned.getTime(), end?.getTime() ?? Infinity) - left.getTime()));
export function focusTeacherWhere(role: string, teacherId: string | null) {
  if (role === "ADMIN") return {};
  if (role === "TEACHER" && teacherId) return { student: { group: { teacherId } } };
  return null;
}
