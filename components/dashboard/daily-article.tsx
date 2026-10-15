import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ARTICLE_LESSONS, ARTICLE_LEVELS, articlesForLevel } from "@/lib/articles/catalog";

export function DailyArticle() {
  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Newspaper className="h-5 w-5" /> Articles</CardTitle></CardHeader>
      <CardContent>
        <p className="text-white font-semibold mb-2">Choose an article for your level</p>
        <p className="text-sm text-gray-400 mb-3">{ARTICLE_LESSONS.length} reading lessons with vocabulary, exercises and discussion.</p>
        <div className="flex flex-wrap gap-2 mb-3">{ARTICLE_LEVELS.map(level => <Link key={level} href={`/article?level=${encodeURIComponent(level)}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 px-3 text-sm text-averna-cyan hover:underline">{level} · {articlesForLevel(level).length}</Link>)}</div>
        <Link href="/article" className="text-sm text-averna-neon hover:underline inline-flex min-h-[44px] items-center gap-1">Browse all articles <ArrowRight className="h-3.5 w-3.5" /></Link>
      </CardContent>
    </Card>
  );
}
