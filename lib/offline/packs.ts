/**
 * Offline packs (idea 7): what "Save for offline" keeps on the device. One IndexedDB record
 * per pack (lib/offline/store.ts); big files (interactive lesson HTML, recordings) sit in the
 * packs cache and the record points at them. Every pack is tagged with the user who saved it.
 * Pure types and helpers, safe on the server and in the browser.
 */
import type { ArticleLesson } from "@/lib/articles/catalog";
import type { Flashcard } from "@/lib/flashcards-data";
import type { ClientGroup, ExamAnswers } from "@/lib/ielts/types";
import type { SrsMap } from "@/lib/srs";

export type PackKind = "flashcards" | "article" | "listening";

interface PackBase {
  id: string;
  kind: PackKind;
  /** The user who saved it: other users never see it, and sign-out wipes it. */
  ownerId: string;
  title: string;
  subtitle: string;
  /** Epoch ms. */
  savedAt: number;
  /** Bytes on the device: the record plus its files. */
  bytes: number;
}

/** A flashcard with the key its spaced-repetition state is stored under. */
export interface OfflineCard extends Flashcard {
  key: string;
}

export interface FlashcardsPack extends PackBase {
  kind: "flashcards";
  cards: OfflineCard[];
  /** The cards' review state when saved, updated as they are studied offline. */
  srs: SrsMap;
}

export type OfflineArticle = Pick<
  ArticleLesson,
  "slug" | "title" | "level" | "body" | "blocks" | "vocabulary" | "notes" | "exercises" | "discussion" | "writingInstruction"
>;

export interface ArticlePack extends PackBase {
  kind: "article";
  slug: string;
  /** A reading lesson: its text, words and exercises. */
  article?: OfflineArticle;
  /** An interactive lesson: its HTML file, kept in the packs cache under `file`. */
  lesson?: { slug: string; title: string; topic: string; file: string };
}

export interface ListeningPack extends PackBase {
  kind: "listening";
  testId: string;
  partIndex: number;
  testTitle: string;
  context: string;
  /** The part's questions as the practice runner gets them (no answers). */
  groups: ClientGroup[];
  /** The recording, kept in the packs cache under `file` (its original URL). */
  audio: { file: string; durationMs: number };
  /** Answers typed offline (never marked offline: the answer key never reaches the browser). */
  answers?: ExamAnswers;
}

export type OfflinePack = FlashcardsPack | ArticlePack | ListeningPack;

export const packIds = {
  deck: (deckId: string) => `flashcards:deck:${deckId}`,
  due: () => "flashcards:due",
  article: (slug: string) => `article:${slug}`,
  listening: (testId: string, partIndex: number) => `listening:${testId}:${partIndex}`,
};

/** UTF-8 size of a value as JSON (what a record costs, roughly). */
export function jsonBytes(value: unknown): number {
  const text = JSON.stringify(value) ?? "";
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
  return text.length;
}

/** The structured article fields a pack keeps (no source hashes or file names). */
export function offlineArticle(article: OfflineArticle | ArticleLesson): OfflineArticle {
  const { slug, title, level, body, blocks, vocabulary, notes, exercises, discussion, writingInstruction } = article;
  return { slug, title, level, body, blocks, vocabulary, notes, exercises, discussion, writingInstruction };
}

/** Whether a stored value looks like a pack this version can open (IndexedDB data is untrusted). */
export function isPack(value: unknown): value is OfflinePack {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<OfflinePack>;
  if (typeof p.id !== "string" || typeof p.ownerId !== "string" || typeof p.title !== "string") return false;
  if (typeof p.savedAt !== "number" || typeof p.bytes !== "number") return false;
  if (p.kind === "flashcards") return Array.isArray((p as FlashcardsPack).cards) && !!(p as FlashcardsPack).srs;
  if (p.kind === "article") return !!(p as ArticlePack).article || !!(p as ArticlePack).lesson;
  if (p.kind === "listening") return Array.isArray((p as ListeningPack).groups) && !!(p as ListeningPack).audio;
  return false;
}
