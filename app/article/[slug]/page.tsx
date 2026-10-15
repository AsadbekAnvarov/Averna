export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findArticle } from "@/lib/articles/catalog";
import { ArticleLesson } from "@/components/articles/article-lesson";
import "../articles.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: findArticle(slug)?.title ?? "Article not found" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();
  return <ArticleLesson article={article} />;
}
