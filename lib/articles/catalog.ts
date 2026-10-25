import catalog from "./catalog.json";

export const ARTICLE_LEVELS = ["Pre-intermediate", "Intermediate"] as const;
export type ArticleLevel = (typeof ARTICLE_LEVELS)[number];
export type ArticlePart = { text: string; highlight: boolean };
export type ArticleBlock = { kind: "heading" | "paragraph" | "caption"; parts: ArticlePart[] };
export type ArticleExercise = {
  id: string;
  title: string;
  instruction: string;
  questions: { prompt: string; options: string[]; answer: string; explanation: string }[];
};
export type ArticleLesson = {
  slug: string;
  title: string;
  level: ArticleLevel;
  description: string;
  blocks: ArticleBlock[];
  body: string;
  vocabulary: { word: string; meaning: string; group: string }[];
  notes: string[];
  exercises: ArticleExercise[];
  discussion: string[];
  writingInstruction: string;
  sourceFile: string;
  sourceSha256: string;
};

// Permanent, versioned lessons from the supplied archives. No daily rotation,
// expiring file links, database seed or external scripts are required.
export const ARTICLE_LESSONS = catalog as ArticleLesson[];
export function findArticle(slug: string) {
  return ARTICLE_LESSONS.find(article => article.slug === slug);
}
export function articlesForLevel(level?: string) {
  return ARTICLE_LESSONS.filter(article => !level || article.level === level);
}
export function articleReadingMinutes(article: ArticleLesson) {
  return Math.max(1, Math.ceil(article.body.trim().split(/\s+/).length / 180));
}
