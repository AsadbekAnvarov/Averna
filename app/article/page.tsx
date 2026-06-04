export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, BookMarked } from "lucide-react";
import Link from "next/link";
import { getTodayArticle } from "@/lib/daily-content";

export default async function ArticlePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const article = getTodayArticle();
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Newspaper className="h-7 w-7 text-averna-cyan" />
          Article of the Day
        </h1>
        <p className="text-xs text-gray-500 mb-6">{today} · a new article every day</p>

        <Card className="glass border-averna-cyan/30 mb-6">
          <CardHeader><CardTitle className="text-white">{article.title}</CardTitle></CardHeader>
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
