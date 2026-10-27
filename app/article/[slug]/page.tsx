export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findArticle } from "@/lib/articles/catalog";
import { findInteractiveLesson } from "@/lib/articles/interactive";
import { ArticleLesson } from "@/components/articles/article-lesson";
import { InteractiveLesson } from "@/components/articles/interactive-lesson";
import { SaveInteractiveOffline } from "@/components/offline/save-article-offline";
import "../articles.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: findArticle(slug)?.title ?? findInteractiveLesson(slug)?.title ?? "Article not found" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const { slug } = await params;
  // The 13 interactive Intermediate lessons run unchanged in a sandboxed frame.
  const interactive = findInteractiveLesson(slug);
  if (interactive) {
    const lesson = { slug: interactive.slug, title: interactive.title, topic: interactive.topic };
    return <InteractiveLesson lesson={lesson} userId={session.user.id} actions={<SaveInteractiveOffline lesson={lesson} />} />;
  }
  const article = findArticle(slug);
  if (!article) notFound();
  return <ArticleLesson article={article} />;
}
