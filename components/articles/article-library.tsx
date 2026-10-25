import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Newspaper } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ARTICLE_LEVELS, articleReadingMinutes } from "@/lib/articles/catalog";
import { interactiveReadingMinutes } from "@/lib/articles/interactive";
import { libraryCount, libraryItems } from "@/lib/articles/library";

export function ArticleLibrary({ level }: { level?: string }) {
  const selected = ARTICLE_LEVELS.find(item => item === level);
  const items = libraryItems(selected);
  return (
    <main className="article-space min-h-screen premium-gradient">
      <div className="article-container">
        <PageHeader back={{ href: "/dashboard", label: "Back to Dashboard" }} icon={Newspaper} title="Articles" subtitle="Choose your level. Read, learn vocabulary and practise." />
        <nav className="article-filters" aria-label="Article level">
          <Link href="/article" aria-current={!selected ? "page" : undefined}>All articles <span>{libraryCount()}</span></Link>
          {ARTICLE_LEVELS.map(item => <Link key={item} href={`/article?level=${encodeURIComponent(item)}`} aria-current={selected === item ? "page" : undefined}>{item} <span>{libraryCount(item)}</span></Link>)}
        </nav>
        <p className="article-muted article-count">{items.length} {items.length === 1 ? "article" : "articles"} · Available whenever you want to read</p>
        <div className="article-grid">
          {items.map(item => item.kind === "structured" ? <Link className="article-card article-library-card" href={`/article/${item.lesson.slug}`} key={item.lesson.slug}>
            <div className="article-card-top"><span className="article-level">{item.lesson.level}</span><BookOpen size={22} aria-hidden="true" /></div>
            <h2>{item.lesson.title}</h2>
            <p className="article-preview article-muted">{item.lesson.body.split("\n\n")[1]}</p>
            <p className="article-meta"><Clock size={16} aria-hidden="true" /> {articleReadingMinutes(item.lesson)} min read <span>·</span> {item.lesson.vocabulary.length} key words</p>
            <div className="article-card-bottom"><span>{item.lesson.exercises.length} exercise sets + discussion</span><span className="article-open">Read article <ArrowRight size={17} aria-hidden="true" /></span></div>
          </Link> : <Link className="article-card article-library-card" href={`/article/${item.lesson.slug}`} key={item.lesson.slug}>
            <div className="article-card-top"><span className="article-level">{item.lesson.level}</span><span className="article-emoji" aria-hidden="true">{item.lesson.emoji}</span></div>
            <h2>{item.lesson.title}</h2>
            <p className="article-preview article-muted">{item.lesson.description}</p>
            <p className="article-meta"><Clock size={16} aria-hidden="true" /> {interactiveReadingMinutes(item.lesson)} min read <span>·</span> {item.lesson.wordCount} key words</p>
            <div className="article-card-bottom"><span>Interactive lesson: games, quizzes and writing</span><span className="article-open">Open lesson <ArrowRight size={17} aria-hidden="true" /></span></div>
          </Link>)}
        </div>
      </div>
    </main>
  );
}
