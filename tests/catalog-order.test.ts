import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareTestTitles } from "@/lib/ielts/catalog-order";

const paper = (n: number, skill: string, task?: number) => ({ id: `cdi-${skill}-${n}`, title: `Averna CDI ${skill} ${n}${task ? ` · Task ${task}` : ""}` });
describe("CDI natural library ordering", () => {
  for (const skill of ["Reading", "Listening", "Speaking", "Writing"]) {
    for (const task of skill === "Writing" ? [1, 2] : [undefined]) {
      it(`${skill}${task ? ` Task ${task}` : ""}: orders 1, 2, 3, 10 rather than upload order`, () => {
        const rows = [12, 3, 1, 20, 10, 2, 11].map(n => paper(n, skill, task));
        const before = structuredClone(rows);
        const sorted = [...rows].sort(compareTestTitles);
        expect(sorted.map(row => row.title)).toEqual([1, 2, 3, 10, 11, 12, 20].map(n => paper(n, skill, task).title));
        expect(rows).toEqual(before);
        expect(new Set(sorted.map(row => row.id))).toEqual(new Set(rows.map(row => row.id)));
      });
    }
  }
  it("preserves original numbering gaps and handles leading zeros", () => {
    const rows = ["Test 10", "Test 02", "Test 1", "Test 12"].map(title => ({ id: title, title }));
    expect(rows.sort(compareTestTitles).map(row => row.title)).toEqual(["Test 1", "Test 02", "Test 10", "Test 12"]);
  });
  it("orders unnumbered teacher resource topics alphabetically with stable ID tie breaks", () => {
    const rows = [{ id: "b", title: "Water" }, { id: "z", title: "Attention Spans" }, { id: "a", title: "Water" }];
    expect(rows.sort(compareTestTitles).map(row => row.id)).toEqual(["z", "a", "b"]);
  });
  it("wires all libraries to the same numeric order and invalidates old cached order", () => {
    const catalog = readFileSync("lib/ielts/catalog.ts", "utf8");
    expect(catalog).toContain("rank[a.source] - rank[b.source] || compareTestTitles(a, b)");
    expect(catalog).toContain("return generated.sort(compareTestTitles)");
    for (const skill of ["reading", "listening", "speaking"]) expect(catalog).toContain(`exam-catalog-${skill}-cdi-v3-natural-order`);
    for (const path of ["lib/writing-content.ts", "lib/speaking-content.ts", "app/teacher/mock/resources/page.tsx"]) {
      expect(readFileSync(path, "utf8")).toContain(".sort(compareTestTitles)");
    }
  });
});
