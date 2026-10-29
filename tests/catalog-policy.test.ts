import { describe, expect, it } from "vitest";
import { isVisibleObjectivePaper, objectiveCollection } from "@/lib/ielts/catalog-policy";
import type { ExamDifficulty, ExamSource } from "@/lib/ielts/types";

describe("supplied CDI and protected Medium catalog", () => {
  it("retains every imported CDI regardless of difficulty", () => {
    for (const difficulty of ["Easy", "Medium", "Hard"] as ExamDifficulty[])
      expect(isVisibleObjectivePaper({ source: "imported", difficulty })).toBe(true);
  });
  it("retains all Medium, including generated and old practice", () => {
    for (const source of ["imported", "generated", "legacy", "averna"] as ExamSource[])
      expect(isVisibleObjectivePaper({ source, difficulty: "Medium" })).toBe(true);
  });
  it("excludes non-imported Easy and Hard from new choices", () => {
    for (const source of ["generated", "legacy", "averna"] as ExamSource[])
      for (const difficulty of ["Easy", "Hard"] as ExamDifficulty[])
        expect(isVisibleObjectivePaper({ source, difficulty })).toBe(false);
  });
  it("separates original CDI, Volume 10 and preserved Medium without renumbering", () => {
    expect(objectiveCollection({source:"imported",title:"Averna CDI Reading 12"})).toBe("Averna CDI");
    expect(objectiveCollection({source:"imported",title:"Averna CDI Volume 10 · Listening Test 2"})).toBe("Averna CDI · Volume 10");
    expect(objectiveCollection({source:"legacy",title:"Old practice"})).toBe("Medium practice");
  });
});
