export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ArticleLibrary } from "@/components/articles/article-library";
import "./articles.css";

export const metadata = { title: "Articles" };

export default async function ArticlePage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const { level } = await searchParams;
  return <ArticleLibrary level={level} />;
}
