import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ARTICLE_LEVELS } from "@/lib/articles/catalog";
import { libraryCount } from "@/lib/articles/library";
import { cn } from "@/lib/utils";
import { DASH_CARD } from "@/components/ui/dash-row";

export function DailyArticle() {
  return (
    <Card className={cn(DASH_CARD, "glass border-averna-cyan/30")}>
      <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Newspaper className="h-5 w-5" /> Articles</CardTitle></CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-white font-semibold mb-2">Choose an article for your level</p>
        <p className="text-sm text-gray-400 mb-3">{libraryCount()} lessons with reading, vocabulary and practice.</p>
        <div className="flex flex-wrap gap-2 mb-3">{ARTICLE_LEVELS.map(level => <Link key={level} href={`/article?level=${encodeURIComponent(level)}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 px-3 text-sm text-averna-cyan hover:underline">{level} · {libraryCount(level)}</Link>)}</div>
        {/* Footer link sits at the bottom of a stretched card. */}
        <Link href="/article" className="mt-auto self-start text-sm text-averna-neon hover:underline inline-flex min-h-[44px] items-center gap-1">Browse all articles <ArrowRight className="h-3.5 w-3.5" /></Link>
      </CardContent>
    </Card>
  );
}
