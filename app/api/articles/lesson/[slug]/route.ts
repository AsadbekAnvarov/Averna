import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findInteractiveLesson } from "@/lib/articles/interactive";
import { buildLessonDocument, LESSON_HEADERS } from "@/lib/articles/lesson-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The interactive lesson document for the sandboxed frame on /article/[slug].
 * The file is served unchanged apart from the storage/theme shim (lib/articles/lesson-document.ts);
 * its CSP keeps it opaque-origin and offline. Signed-in users only, like /article.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const lesson = findInteractiveLesson(slug);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const html = await readFile(path.join(process.cwd(), "content/articles/intermediate", lesson.sourceFile), "utf8");
  return new NextResponse(buildLessonDocument(html), { status: 200, headers: LESSON_HEADERS });
}
