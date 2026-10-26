import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

describe("Speaking hub (/learning/speaking)", () => {
  const hubFiles = ["app/learning/speaking/page.tsx", "components/speaking/peer-hub.tsx", "components/speaking/mic-check.tsx"];

  it("no longer renders the teacher-led practice page", () => {
    for (const f of hubFiles) {
      expect(src(f)).not.toMatch(/TeacherSpeakingPractice|teacher-speaking-practice/);
      expect(src(f)).not.toMatch(/teacher-led Mock/i);
    }
  });

  it("leads with peer speaking and links the other ways to practise", () => {
    const page = src("app/learning/speaking/page.tsx");
    expect(page).toContain("PeerSpeakingHub");
    for (const href of ["/learning/speaking/solo", "/learning/examiner", "/learning/speaking-test"]) expect(page).toContain(href);
    const hub = src("components/speaking/peer-hub.tsx");
    expect(hub).toContain("Speak with a partner");
    expect(hub).toContain("Find a partner");
    expect(hub).toContain("/teacher/speaking");
    expect(hub).toMatch(/Nothing is recorded/);
  });

  it("keeps the teacher-led entry on /learning/speaking-test and the solo runner without matching", () => {
    expect(src("app/learning/speaking-test/page.tsx")).toContain("TeacherSpeakingPractice");
    const runner = src("components/learning/speaking-runner.tsx");
    expect(runner).not.toMatch(/\/api\/speaking\/match/);
    expect(existsSync(join(root, "app/learning/speaking/solo/page.tsx"))).toBe(true);
    expect(src("app/teacher/speaking/page.tsx")).toContain("Peer speaking sessions of your groups will appear here");
  });
});
