"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { ArticleExercises } from "@/components/articles/article-exercises";
import { InteractiveLesson } from "@/components/articles/interactive-lesson";
import { offlineLessonDocument } from "@/lib/articles/lesson-document";
import type { ArticlePack } from "@/lib/offline/packs";
import { readPackFile } from "@/lib/offline/store";

/**
 * Reading a saved article with no connection (idea 7). A reading lesson renders from its
 * saved text; an interactive lesson runs its saved HTML in the same sandboxed, opaque-origin
 * frame as online, from a blob: URL, with its content policy as a <meta> tag.
 */
export function OfflineReader({ pack, onBack }: { pack: ArticlePack; onBack: () => void }) {
  if (pack.lesson) return <OfflineInteractive pack={pack} lesson={pack.lesson} onBack={onBack} />;
  const article = pack.article;
  if (!article) return null;
  return (
    <div className="article-space">
      <div className="article-reader">
        <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-sm font-medium text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Saved on this device
        </button>
        <h1 className="flex items-start gap-3 text-2xl font-bold text-white">
          <BookOpen className="mt-1 h-6 w-6 shrink-0 text-averna-cyan" aria-hidden />
          {article.title}
        </h1>
        <p className="mt-1 text-sm text-gray-400">{article.level} · Reading lesson · saved for offline</p>
        <nav className="article-filters" aria-label="Lesson sections">
          <a href="#reading">Read the article</a>
          <a href="#vocabulary">Key vocabulary</a>
          <a href="#exercises">Exercises</a>
        </nav>
        <section id="reading" className="article-card article-section">
          <h2>The article</h2>
          <article className="article-body">
            {article.blocks.map((block, i) => {
              const content = block.parts.map((part, j) => (part.highlight ? <mark key={j}>{part.text}</mark> : part.text));
              return block.kind === "heading" ? <h3 key={i}>{content}</h3> : block.kind === "caption" ? <p key={i} className="article-caption">{content}</p> : <p key={i}>{content}</p>;
            })}
          </article>
        </section>
        <section id="vocabulary" className="article-card article-section">
          <h2>Key vocabulary</h2>
          <dl className="article-vocabulary">
            {article.vocabulary.map((item, i) => (
              <div key={item.word}>
                <dt>
                  {item.group && (i === 0 || item.group !== article.vocabulary[i - 1].group) && <span className="article-vocab-group block">{item.group}</span>}
                  {item.word}
                </dt>
                <dd>{item.meaning}</dd>
              </div>
            ))}
          </dl>
          {article.notes.length > 0 && (
            <details className="article-notes">
              <summary>Word-building & memory tips</summary>
              {article.notes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </details>
          )}
        </section>
        <ArticleExercises exercises={article.exercises} discussion={article.discussion} writingInstruction={article.writingInstruction} />
      </div>
    </div>
  );
}

function OfflineInteractive({ pack, lesson, onBack }: { pack: ArticlePack; lesson: NonNullable<ArticlePack["lesson"]>; onBack: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void readPackFile(lesson.file).then(async (blob) => {
      if (!alive) return;
      if (!blob) return setMissing(true);
      try {
        const html = offlineLessonDocument(await blob.text());
        url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        if (alive) setSrc(url);
      } catch {
        setMissing(true);
      }
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [lesson.file]);

  if (missing) {
    return (
      <div role="alert" className="glass rounded-2xl border border-white/10 p-6 text-center">
        <p className="text-gray-200">This lesson&apos;s saved file is missing. Remove it and save it again when you&apos;re online.</p>
        <button type="button" onClick={onBack} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Saved on this device
        </button>
      </div>
    );
  }
  if (!src) return <p role="status" className="text-sm text-gray-400">Opening the lesson…</p>;
  return <InteractiveLesson lesson={{ slug: lesson.slug, title: lesson.title, topic: lesson.topic }} userId={pack.ownerId} src={src} onBack={onBack} />;
}
