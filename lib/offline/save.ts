/**
 * "Save for offline" for each kind of pack (idea 7). Browser only.
 * Sizes shown before saving come from estimateListeningBytes and jsonBytes.
 */
import type { ArticleLesson } from "@/lib/articles/catalog";
import type { Flashcard } from "@/lib/flashcards-data";
import type { ClientGroup } from "@/lib/ielts/types";
import type { SrsMap } from "@/lib/srs";
import { DUE_PACK_MAX } from "./constants";
import { offlineArticle, packIds, type OfflineArticle, type OfflineCard } from "./packs";
import { savePack, type SaveResult } from "./store";
import { dueSnapshot } from "./study";

/** Keeps the cards' review state that the pack needs (the device map holds every card). */
function srsFor(cards: OfflineCard[], srs: SrsMap): SrsMap {
  const out: SrsMap = {};
  for (const c of cards) if (srs[c.key]) out[c.key] = srs[c.key];
  return out;
}

export const deckCards = (cards: Flashcard[]): OfflineCard[] => cards.map((c) => ({ ...c, key: c.word }));

export function saveDeck(ownerId: string, deck: { id: string; name: string; band: string; cards: Flashcard[] }, srs: SrsMap): Promise<SaveResult> {
  const cards = deckCards(deck.cards);
  return savePack({
    id: packIds.deck(deck.id),
    kind: "flashcards",
    ownerId,
    title: `${deck.name} flashcards`,
    subtitle: `${cards.length} cards · ${deck.band}`,
    savedAt: Date.now(),
    bytes: 0,
    cards,
    srs: srsFor(cards, srs),
  });
}

/** "Save my due cards": a snapshot of today's review queue (at most DUE_PACK_MAX cards). */
export function saveDueCards(ownerId: string, pool: Flashcard[], srs: SrsMap, now = Date.now()): Promise<SaveResult> {
  const cards = dueSnapshot(deckCards(pool), srs, now, DUE_PACK_MAX);
  return savePack({
    id: packIds.due(),
    kind: "flashcards",
    ownerId,
    title: "My due cards",
    subtitle: `${cards.length} ${cards.length === 1 ? "card" : "cards"} due on ${new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    savedAt: now,
    bytes: 0,
    cards,
    srs: srsFor(cards, srs),
  });
}

export function saveArticle(ownerId: string, article: OfflineArticle | ArticleLesson): Promise<SaveResult> {
  return savePack({
    id: packIds.article(article.slug),
    kind: "article",
    ownerId,
    slug: article.slug,
    title: article.title,
    subtitle: `${article.level} · Reading lesson`,
    savedAt: Date.now(),
    bytes: 0,
    article: offlineArticle(article),
  });
}

/** An interactive lesson: its HTML file (the same document the sandboxed frame loads) goes into the packs cache. */
export async function saveInteractiveLesson(ownerId: string, lesson: { slug: string; title: string; topic: string }): Promise<SaveResult> {
  const file = `/api/articles/lesson/${encodeURIComponent(lesson.slug)}`;
  let blob: Blob;
  try {
    const res = await fetch(file, { credentials: "same-origin" });
    if (!res.ok) return { ok: false, reason: "error", message: "Couldn't download this lesson. Check your connection and try again." };
    blob = new Blob([await res.text()], { type: "text/html; charset=utf-8" });
  } catch {
    return { ok: false, reason: "error", message: "Couldn't download this lesson. Check your connection and try again." };
  }
  return savePack(
    {
      id: packIds.article(lesson.slug),
      kind: "article",
      ownerId,
      slug: lesson.slug,
      title: lesson.title,
      subtitle: `Intermediate · ${lesson.topic} · Interactive lesson`,
      savedAt: Date.now(),
      bytes: 0,
      lesson: { ...lesson, file },
    },
    [{ url: file, blob }],
  );
}

/** About 160 kbps MP3 (lib/ielts/audio/render.ts): the size estimate when the host gives none. */
export function estimateAudioBytes(durationMs: number): number {
  return Math.round((Math.max(0, durationMs) / 1000) * 20_000);
}

export type AudioProbe = { ok: true; bytes: number; exact: boolean } | { ok: false };

/**
 * Whether a recording can be saved, and its size, before downloading it. The recording host
 * must allow this site to read the file (CORS); an opaque copy is never stored.
 */
export async function probeAudio(url: string, durationMs: number): Promise<AudioProbe> {
  try {
    const res = await fetch(url, { method: "HEAD", mode: "cors", credentials: "omit" });
    if (!res.ok) return { ok: false };
    const length = Number(res.headers.get("content-length"));
    return Number.isFinite(length) && length > 0 ? { ok: true, bytes: length, exact: true } : { ok: true, bytes: estimateAudioBytes(durationMs), exact: false };
  } catch {
    return { ok: false };
  }
}

export interface ListeningPartInput {
  testId: string;
  testTitle: string;
  partIndex: number;
  partTitle: string;
  context: string;
  groups: ClientGroup[];
  audio: { url: string; durationMs: number };
}

export async function saveListeningPart(ownerId: string, part: ListeningPartInput): Promise<SaveResult> {
  let blob: Blob;
  try {
    const res = await fetch(part.audio.url, { mode: "cors", credentials: "omit" });
    if (!res.ok || res.type === "opaque") throw new Error("unreadable");
    blob = await res.blob();
  } catch {
    return { ok: false, reason: "error", message: "This recording can't be saved for offline use. Listen to it online instead." };
  }
  return savePack(
    {
      id: packIds.listening(part.testId, part.partIndex),
      kind: "listening",
      ownerId,
      testId: part.testId,
      partIndex: part.partIndex,
      testTitle: part.testTitle,
      title: `${part.testTitle} · ${part.partTitle}`,
      subtitle: "Listening practice",
      context: part.context,
      savedAt: Date.now(),
      bytes: 0,
      groups: part.groups,
      audio: { file: part.audio.url, durationMs: part.audio.durationMs },
    },
    [{ url: part.audio.url, blob: blob.type ? blob : new Blob([blob], { type: "audio/mpeg" }) }],
  );
}
