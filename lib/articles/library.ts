import { articlesForLevel, type ArticleLesson } from "./catalog";
import { INTERACTIVE_LESSONS, type InteractiveLesson } from "./interactive";

/** One card in the Articles library: a structured reading lesson or an interactive lesson. */
export type LibraryItem =
  | { kind: "structured"; lesson: ArticleLesson }
  | { kind: "interactive"; lesson: InteractiveLesson };

/** Structured lessons first (their existing order), then the interactive ones for that level. */
export function libraryItems(level?: string): LibraryItem[] {
  return [
    ...articlesForLevel(level).map((lesson): LibraryItem => ({ kind: "structured", lesson })),
    ...INTERACTIVE_LESSONS.filter(lesson => !level || lesson.level === level).map((lesson): LibraryItem => ({ kind: "interactive", lesson })),
  ];
}

export function libraryCount(level?: string) {
  return libraryItems(level).length;
}
