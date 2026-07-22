export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { TestGeneratorPanel } from "@/components/admin/test-generator-panel";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, FileText, Trash2, BookOpen } from "lucide-react";

async function deleteGeneratedTest(formData: FormData) {
  "use server";
  await requireTeacherOrAdmin();
  const id = String(formData.get("id") || "");
  if (id) {
    try {
      await db.generatedTest.delete({ where: { id } });
    } catch {
      /* ignore — may already be gone */
    }
  }
  revalidatePath("/admin/generate-tests");
}

export default async function GenerateTestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "TEACHER") redirect("/dashboard");

  const dbUser = await db.user.findUnique({ where: { id: session.user.id } });

  let tests: { id: string; module: string; title: string; description: string; published: boolean; createdAt: Date; data: unknown }[] = [];
  try {
    tests = await db.generatedTest.findMany({
      where: { module: { in: ["READING", "LISTENING", "WRITING", "SPEAKING"] } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    tests = [];
  }

  const questionCount = (data: unknown): number => {
    const d = data as {
      passages?: { questions?: unknown[] }[];
      sections?: { questions?: unknown[] }[];
    };
    const groups = d?.passages ?? d?.sections ?? [];
    return groups.reduce((n, p) => n + (p.questions?.length ?? 0), 0);
  };

  const moduleLabel = (m: string) =>
    m === "LISTENING" ? "Listening" : m === "WRITING" ? "Writing" : m === "SPEAKING" ? "Speaking" : "Reading";

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        <AdminHeader user={{ name: dbUser?.name ?? "Admin", email: dbUser?.email ?? "", image: dbUser?.image ?? null }} />

        <PageHeader
          back={{ href: "/admin/dashboard", label: "Back to Admin Panel" }}
          icon={Sparkles}
          iconClassName="text-averna-purple"
          title={<>Test <span className="neon-text-purple">Generator</span></>}
          subtitle="Create original IELTS Reading & Listening tests and Writing Task 2 prompts, then publish them to students."
        />

        <TestGeneratorPanel />

        <div className="mt-8">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-averna-cyan" />
            Generated Tests
          </h2>

          {tests.length === 0 ? (
            <Card className="glass border-averna-primary/30">
              <CardContent className="py-2">
                <EmptyState
                  icon={FileText}
                  title="No generated tests yet"
                  description="Generate your first original Reading test above — once published it appears in the students' Reading section."
                  accent="text-averna-purple"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tests.map((t) => (
                <div key={t.id} className="glass rounded-xl border border-white/5 p-4 flex items-center gap-4">
                  <FileText className="h-5 w-5 text-averna-cyan shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{t.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {t.module === "WRITING"
                        ? t.description || "Task 2 essay prompt"
                        : t.module === "SPEAKING"
                        ? t.description || "Speaking practice set"
                        : `${t.description} · ${questionCount(t.data)} questions`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-averna-cyan/40 text-averna-cyan bg-averna-cyan/10">
                    {moduleLabel(t.module)}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${
                      t.published
                        ? "text-averna-neon border-averna-neon/40 bg-averna-neon/10"
                        : "text-yellow-300 border-yellow-500/40 bg-yellow-500/10"
                    }`}
                  >
                    {t.published ? "Published" : "Draft"}
                  </span>
                  <form action={deleteGeneratedTest}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      aria-label="Delete test"
                      className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
