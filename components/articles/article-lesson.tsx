import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LookupArea } from "@/components/dictionary/lookup-area";
import { ArticleListen } from "@/components/article-listen";
import { ArticleExercises } from "./article-exercises";
import { ARTICLE_LESSONS, articleReadingMinutes, type ArticleLesson as Lesson } from "@/lib/articles/catalog";
import { offlineArticle } from "@/lib/offline/packs";
import { SaveArticleOffline } from "@/components/offline/save-article-offline";

export function ArticleLesson({ article }: { article: Lesson }) {
  const position = ARTICLE_LESSONS.findIndex(item => item.slug === article.slug);
  const next = ARTICLE_LESSONS[position + 1];
  return <main className="article-space min-h-screen premium-gradient">
    <div className="article-container article-reader">
      <PageHeader back={{ href: `/article?level=${encodeURIComponent(article.level)}`, label: "Back to Articles" }} icon={BookOpen} title={article.title} subtitle={<>{article.level} · Reading lesson</>} />
      <div className="article-reader-tools"><p className="article-meta"><Clock size={16} aria-hidden="true" />{articleReadingMinutes(article)} min read · {article.vocabulary.length} key words</p><ArticleListen text={article.body} title={article.title} /><SaveArticleOffline article={offlineArticle(article)} /></div>
      <nav className="article-filters" aria-label="Lesson sections"><a href="#reading">Read the article</a><a href="#vocabulary">Key vocabulary</a><a href="#exercises">Exercises</a></nav>
      <section id="reading" className="article-card article-section">
        <h2>The article</h2>
        <p className="article-muted article-tip">Select a word to look it up and add it to My words. Listen uses your device’s text-to-speech voice.</p>
        <LookupArea><article className="article-body">{article.blocks.map((block, i) => {
          const content = block.parts.map((part, j) => part.highlight ? <mark key={j}>{part.text}</mark> : part.text);
          return block.kind === "heading" ? <h3 key={i}>{content}</h3> : block.kind === "caption" ? <p key={i} className="article-caption">{content}</p> : <p key={i}>{content}</p>;
        })}</article></LookupArea>
      </section>
      <section id="vocabulary" className="article-card article-section"><h2>Key vocabulary</h2><LookupArea><dl className="article-vocabulary">{article.vocabulary.map((item, i) => <div key={item.word}>
        <dt>{item.group && (i === 0 || item.group !== article.vocabulary[i - 1].group) && <span className="article-vocab-group block">{item.group}</span>}{item.word}</dt><dd>{item.meaning}</dd>
      </div>)}</dl></LookupArea>{article.notes.length > 0 && <details className="article-notes"><summary>Word-building & memory tips</summary>{article.notes.map((note, i) => <p key={i}>{note}</p>)}</details>}</section>
      <ArticleExercises key={article.slug} exercises={article.exercises} discussion={article.discussion} writingInstruction={article.writingInstruction} />
      <nav className="article-actions article-footer-nav" aria-label="Continue reading"><Link href="/article">All articles</Link>{next && <Link href={`/article/${next.slug}`}>Next: {next.title} →</Link>}</nav>
    </div>
  </main>;
}
