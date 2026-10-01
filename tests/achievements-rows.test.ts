/**
 * Dashboard achievements card rows (lib/dashboard/achievements.ts).
 */
import { describe, expect, it } from "vitest";
import { rankAchievementRows } from "@/lib/dashboard/achievements";

const PROGRESS: Record<string, { current: number; target: number }> = {
  HALF: { current: 5, target: 10 },
  COMPLETE: { current: 12, target: 10 },
  NEAR: { current: 9, target: 10 },
  NONE: { current: 0, target: 10 },
};

const progress = (type: string) => {
  const { current, target } = PROGRESS[type];
  return { current, target, percent: Math.min(100, Math.round((current / target) * 100)) };
};

const a = (id: string, type: string) => ({ id, type });

describe("rankAchievementRows", () => {
  it("marks a complete but not-yet-awarded badge as ready, capped at target", () => {
    const [row] = rankAchievementRows([a("1", "COMPLETE")], new Set(), progress);
    expect(row).toMatchObject({ done: false, ready: true, current: 10, target: 10, pct: 100 });
  });

  it("an unlocked badge is done, never ready", () => {
    const [row] = rankAchievementRows([a("1", "COMPLETE")], new Set(["1"]), progress);
    expect(row).toMatchObject({ done: true, ready: false });
  });

  it("orders locked ready first, then by percent; unlocked last; limit 5", () => {
    const list = [
      a("done", "NEAR"),
      a("half", "HALF"),
      a("none", "NONE"),
      a("near", "NEAR"),
      a("ready", "COMPLETE"),
      a("half2", "HALF"),
    ];
    const ids = rankAchievementRows(list, new Set(["done"]), progress).map((r) => r.a.id);
    expect(ids).toEqual(["ready", "near", "half", "half2", "none"]);
    const all = rankAchievementRows(list, new Set(["done"]), progress, 10).map((r) => r.a.id);
    expect(all[all.length - 1]).toBe("done");
  });
});
