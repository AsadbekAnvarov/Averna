import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Newspaper } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ARTICLE_LEVELS, articleReadingMinutes } from "@/lib/articles/catalog";
import { interactiveReadingMinutes } from "@/lib/articles/interactive";
import { libraryCount, libraryItems } from "@/lib/articles/library";

/**
 * The article library. The whole card is the link. On phones the "Read article"
 * row is dropped (an arrow at the top right shows the card opens) and the
 * exercise line joins the meta line, so the 24 cards stay short.
 */
export function ArticleLibrary({ level }: { level?: string }) {
  const selected = ARTICLE_LEVELS.find(item => item === level);
  const items = libraryItems(selected);
  return (
    <main className="article-space min-h-screen premium-gradient">
      <div className="article-container">
        <PageHeader back={{ href: "/dashboard", label: "Back to Dashboard" }} icon={Newspaper} title="Articles" subtitle="Choose your level. Read, learn vocabulary and practise." />
        <nav className="article-filters article-level-filters" aria-label="Article level">
          <Link href="/article" aria-current={!selected ? "page" : undefined}>All articles <span>{libraryCount()}</span></Link>
          {ARTICLE_LEVELS.map(item => <Link key={item} href={`/article?level=${encodeURIComponent(item)}`} aria-current={selected === item ? "page" : undefined}>{item} <span>{libraryCount(item)}</span></Link>)}
        </nav>
        <p className="article-muted article-count">{items.length} {items.length === 1 ? "article" : "articles"} · Available whenever you want to read</p>
        <div className="article-grid">
          {items.map(item => item.kind === "structured" ? <Link className="article-card article-library-card" href={`/article/${item.lesson.slug}`} key={item.lesson.slug}>
            <div className="article-card-top"><span className="article-level">{item.lesson.level}</span><span className="article-card-icons" aria-hidden="true"><BookOpen size={22} /><ArrowRight size={18} className="article-card-arrow" /></span></div>
            <h2>{item.lesson.title}</h2>
            <p className="article-preview article-muted">{item.lesson.body.split("\n\n")[1]}</p>
            <p className="article-meta"><Clock size={16} aria-hidden="true" /> <span>{articleReadingMinutes(item.lesson)} min</span> <span aria-hidden="true">·</span> <span>{item.lesson.vocabulary.length} key words</span> <span aria-hidden="true">·</span> <span>{item.lesson.exercises.length} exercise sets + discussion</span></p>
            <div className="article-card-bottom"><span className="article-open">Read article <ArrowRight size={17} aria-hidden="true" /></span></div>
          </Link> : <Link className="article-card article-library-card" href={`/article/${item.lesson.slug}`} key={item.lesson.slug}>
            <div className="article-card-top"><span className="article-level">{item.lesson.level}</span><span className="article-card-icons" aria-hidden="true"><span className="article-emoji">{item.lesson.emoji}</span><ArrowRight size={18} className="article-card-arrow" /></span></div>
            <h2>{item.lesson.title}</h2>
            <p className="article-preview article-muted">{item.lesson.description}</p>
            <p className="article-meta"><Clock size={16} aria-hidden="true" /> <span>{interactiveReadingMinutes(item.lesson)} min</span> <span aria-hidden="true">·</span> <span>{item.lesson.wordCount} key words</span> <span aria-hidden="true">·</span> <span>Interactive lesson: games, quizzes and writing</span></p>
            <div className="article-card-bottom"><span className="article-open">Open lesson <ArrowRight size={17} aria-hidden="true" /></span></div>
          </Link>)}
        </div>
      </div>
    </main>
  );
}
