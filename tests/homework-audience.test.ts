/** A homework row set for ONE student (Homework.assigneeId, idea 10): only they see it, only they count. */
import { describe, expect, it } from "vitest";
import { forStudent, isForStudent } from "@/lib/homework/audience";
import { buildHomeworkProgress, buildStudentReminder } from "@/lib/telegram/builders";

describe("homework audience", () => {
  it("whole-group homework is for everyone; a personal task only for its student", () => {
    expect(forStudent("st-1")).toEqual({ OR: [{ assigneeId: null }, { assigneeId: "st-1" }] });
    expect(isForStudent({ assigneeId: null }, "st-1")).toBe(true);
    expect(isForStudent({}, "st-1")).toBe(true);
    expect(isForStudent({ assigneeId: "st-1" }, "st-1")).toBe(true);
    expect(isForStudent({ assigneeId: "st-2" }, "st-1")).toBe(false);
  });

  it("Telegram: a classmate's mini task is never in a student's reminder, and counts as 1 of 1 for the teacher", () => {
    const now = new Date("2026-10-26T12:00:00+05:00");
    const due = new Date("2026-10-27T20:00:00+05:00");
    const hw = [
      { id: "h-group", title: "Reading Passage 1", groupId: "g", dueDate: due, assigneeId: null },
      { id: "h-mine", title: "Mini task: Matching headings", groupId: "g", dueDate: due, assigneeId: "st-2" },
    ];
    const reminder = buildStudentReminder(
      { id: "st-1", userId: "u-1", name: "Ali", groupId: "g", currentStreak: 0, lastActiveDate: now },
      hw,
      new Set(),
      now
    );
    expect(reminder?.dueTomorrow.map((d) => d.title)).toEqual(["Reading Passage 1"]);

    const group = { id: "g", name: "B2", students: [{ id: "st-1", name: "Ali" }, { id: "st-2", name: "Bobur" }, { id: "st-3", name: "Dilnoza" }] };
    expect(buildHomeworkProgress(hw[1], group, new Set(), now)).toMatchObject({ submitted: 0, total: 1, missing: ["Bobur"] });
    expect(buildHomeworkProgress(hw[0], group, new Set(["st-1"]), now)).toMatchObject({ submitted: 1, total: 3 });
  });
});
