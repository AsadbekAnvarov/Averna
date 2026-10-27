"use client";

import { jsonBytes, packIds, type OfflineArticle } from "@/lib/offline/packs";
import { saveArticle, saveInteractiveLesson } from "@/lib/offline/save";
import { SaveOfflineButton } from "./save-offline-button";

/** "Save for offline" on a reading lesson: its text, words and exercises (idea 7). */
export function SaveArticleOffline({ article }: { article: OfflineArticle }) {
  return (
    <SaveOfflineButton
      packId={packIds.article(article.slug)}
      bytes={jsonBytes(article)}
      estimated
      onSave={(owner) => saveArticle(owner, article)}
    />
  );
}

/** "Save for offline" on an interactive lesson: its HTML file, run sandboxed offline too. */
export function SaveInteractiveOffline({ lesson }: { lesson: { slug: string; title: string; topic: string } }) {
  return <SaveOfflineButton compact packId={packIds.article(lesson.slug)} onSave={(owner) => saveInteractiveLesson(owner, lesson)} />;
}
