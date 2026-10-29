import type { ExamTestSummary } from "./types";

/** New selections use supplied CDI papers and the explicitly retained Medium
 * practice. Never delete test/audio rows: saved attempts must remain readable.
 */
export function isVisibleObjectivePaper(test: Pick<ExamTestSummary, "source" | "difficulty">): boolean {
  return test.source === "imported" || test.difficulty === "Medium";
}

/** Keep each supplied collection together without changing original numbering. */
export function objectiveCollection(test: Pick<ExamTestSummary, "source" | "title">): string {
  if (test.source !== "imported") return "Medium practice";
  const volume = /\bVolume\s*(\d+)\b/i.exec(test.title);
  return volume ? `Averna CDI · Volume ${Number(volume[1])}` : "Averna CDI";
}
