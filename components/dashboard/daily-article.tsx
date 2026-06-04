import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTodayArticle } from "@/lib/daily-content";

export function DailyArticle() {
  const article = getTodayArticle();
  const preview = article.body.length > 160 ? article.body.slice(0, 160) + "…" : article.body;

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Newspaper className="h-5 w-5" /> Article of the Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-white font-semibold mb-1">{article.title}</p>
        <p className="text-sm text-gray-400 mb-3">{preview}</p>
        <Link href="/article" className="text-sm text-averna-neon hover:underline inline-flex items-center gap-1">
          Read &amp; learn vocabulary <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
