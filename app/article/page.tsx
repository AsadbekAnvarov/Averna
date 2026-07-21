export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, BookMarked, Clock } from "lucide-react";
import { getTodayArticle } from "@/lib/daily-content";
import { PageHeader } from "@/components/ui/page-header";
import { ArticleListen } from "@/components/article-listen";

export default async function ArticlePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const article = getTodayArticle();
  const wordCount = article.body.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Newspaper}
          iconClassName="text-averna-cyan"
          title="Article of the Day"
          subtitle={<>{today} · a new article every day</>}
        />

        <Card className="glass border-averna-cyan/30 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-white">{article.title}</CardTitle>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-xs text-gray-400 flex flex-wrap items-center gap-3">
                {article.theme && (
                  <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-averna-cyan/15 text-averna-cyan border border-averna-cyan/30">
                    {article.theme}
                  </span>
                )}
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes} min read</span>
                <span>{wordCount} words</span>
              </span>
              <ArticleListen text={article.body} title={article.title} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-200 leading-relaxed whitespace-pre-line">{article.body}</p>
          </CardContent>
        </Card>

        {article.vocabulary.length > 0 && (
          <Card className="glass border-averna-purple/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-averna-purple">
                <BookMarked className="h-5 w-5" /> Key Vocabulary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {article.vocabulary.map((v) => (
                <div key={v.word} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-averna-neon font-semibold">{v.word}</span>
                  <span className="text-gray-300 text-sm"> — {v.meaning}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
