/**
 * What the library LISTS (pure, no database): the CDI materials by number,
 * then the admin's published AI-generated tests (newest first, as the database
 * returns them). Built-in Averna / legacy content is archived — resolvable by
 * id in lib/ielts/catalog.ts, never listed — so anything else is dropped here.
 */

import type { ExamSource } from "./types";

/** Sources that appear in student / teacher lists. */
export const LISTED_SOURCES: readonly ExamSource[] = ["cdi", "generated"];

export function isListedSource(source: ExamSource | string | undefined): boolean {
  return source === "cdi" || source === "generated";
}

/** Number of a CDI id ("cdi-reading-07" → 7, "cdi-writing-12-t1" → 12); NaN for other ids. */
export function cdiNumber(id: string): number {
  const m = /^cdi-[a-z]+-(\d+)/.exec(id);
  return m ? Number(m[1]) : NaN;
}

/** CDI items in number order (stable; ids without a number go last). */
export function byCdiNumber<T extends { id: string }>(items: T[]): T[] {
  const n = (id: string) => {
    const v = cdiNumber(id);
    return Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER;
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => n(a.item.id) - n(b.item.id) || a.i - b.i)
    .map((x) => x.item);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/** Reading / Listening list: CDI by number, then generated. A CDI id always wins a clash. */
export function listedExams<T extends { id: string; source: ExamSource }>(cdi: T[], generated: T[]): T[] {
  return uniqueById([
    ...byCdiNumber(cdi.filter((t) => t.source === "cdi")),
    ...generated.filter((t) => t.source === "generated"),
  ]);
}

/** Writing list (prompts carry no source): CDI by number, then generated. */
export function listedWriting<T extends { id: string }>(cdi: T[], generated: T[]): T[] {
  return uniqueById([...byCdiNumber(cdi), ...generated]);
}
