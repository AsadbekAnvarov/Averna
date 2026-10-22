import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Newspaper } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ARTICLE_LESSONS, ARTICLE_LEVELS, articlesForLevel, articleReadingMinutes } from "@/lib/articles/catalog";

export function ArticleLibrary({ level }: { level?: string }) {
  const selected = ARTICLE_LEVELS.find(item => item === level);
  const articles = articlesForLevel(selected);
  return (
    <main className="article-space min-h-screen premium-gradient">
      <div className="article-container">
        <PageHeader back={{ href: "/dashboard", label: "Back to Dashboard" }} icon={Newspaper} title="Articles" subtitle="Choose your level. Read, learn vocabulary and practise with the original exercises." />
        <nav className="article-filters" aria-label="Article level">
          <Link href="/article" aria-current={!selected ? "page" : undefined}>All articles <span>{ARTICLE_LESSONS.length}</span></Link>
          {ARTICLE_LEVELS.map(item => <Link key={item} href={`/article?level=${encodeURIComponent(item)}`} aria-current={selected === item ? "page" : undefined}>{item} <span>{articlesForLevel(item).length}</span></Link>)}
        </nav>
        <p className="article-muted article-count">{articles.length} {articles.length === 1 ? "article" : "articles"} · Available whenever you want to read</p>
        <div className="article-grid">
          {articles.map((article) => <Link className="article-card article-library-card" href={`/article/${article.slug}`} key={article.slug}>
            <div className="article-card-top"><span className="article-level">{article.level}</span><BookOpen size={22} aria-hidden="true" /></div>
            <h2>{article.title}</h2>
            <p className="article-preview article-muted">{article.body.split("\n\n")[1]}</p>
            <p className="article-meta"><Clock size={16} aria-hidden="true" /> {articleReadingMinutes(article)} min read <span>·</span> {article.vocabulary.length} key words</p>
            <div className="article-card-bottom"><span>{article.exercises.length} exercise sets + discussion</span><span className="article-open">Read article <ArrowRight size={17} aria-hidden="true" /></span></div>
          </Link>)}
        </div>
      </div>
    </main>
  );
}
