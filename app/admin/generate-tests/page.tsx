export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth, requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_CATALOG_TAG } from "@/lib/ielts/catalog";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { TestGeneratorPanel } from "@/components/admin/test-generator-panel";
import { ExamBulkGenerator } from "@/components/admin/exam-bulk-generator";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, FileText, Trash2, BookOpen, ChevronDown } from "lucide-react";

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
  revalidateTag(EXAM_CATALOG_TAG);
  revalidatePath("/admin/generate-tests");
}

export default async function GenerateTestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "TEACHER") redirect("/dashboard");

  const dbUser = await db.user.findUnique({ where: { id: session.user.id } });

  // Single-generator rows only: the bulk generator's rows (level "exam-gen:*") are managed by
  // <ExamBulkGenerator /> and would flood this list. `level` is nullable and NOT(LIKE) drops NULLs,
  // so rows without a level are kept explicitly.
  let tests: { id: string; module: string; title: string; description: string; published: boolean; createdAt: Date; data: unknown }[] = [];
  try {
    tests = await db.generatedTest.findMany({
      where: {
        module: { in: ["READING", "LISTENING", "WRITING", "WRITING_TASK1", "SPEAKING"] },
        OR: [{ level: null }, { NOT: { level: { startsWith: "exam-gen" } } }],
      },
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
    m === "LISTENING"
      ? "Listening"
      : m === "WRITING"
      ? "Writing T2"
      : m === "WRITING_TASK1"
      ? "Writing T1"
      : m === "SPEAKING"
      ? "Speaking"
      : "Reading";

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl pb-10 lg:pb-8">
        <AdminHeader user={{ name: dbUser?.name ?? "Admin", email: dbUser?.email ?? "", image: dbUser?.image ?? null }} />

        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Sparkles}
          iconClassName="text-averna-purple"
          title={<>Test <span className="neon-text-purple">generatori</span></>}
          subtitle="Original IELTS Reading, Listening, Writing va Speaking testlarini yarating, koʻrib chiqing va oʻquvchilar uchun nashr qiling."
        />

        {/* Main section: bulk generator (fills the library ~70 tests per skill, step by step). */}
        <ExamBulkGenerator canManage={role === "ADMIN"} />

        {/* The original one-at-a-time generator stays available below. */}
        <details className="group mt-10 rounded-xl border border-white/10 bg-white/[0.02]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gray-200 hover:text-white select-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-averna-purple" aria-hidden />
              Bitta test yaratish (oddiy generator)
              <span className="text-xs font-normal text-gray-500">· {tests.length} ta test</span>
            </span>
            <ChevronDown className="h-4 w-4 text-gray-500 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden />
          </summary>

          <div className="space-y-8 px-4 pb-5 pt-1">
            <TestGeneratorPanel />

            <div>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-averna-cyan" />
                Oddiy generator testlari
              </h2>

              {tests.length === 0 ? (
                <Card className="glass border-averna-primary/30">
                  <CardContent className="py-2">
                    <EmptyState
                      icon={FileText}
                      title="Hozircha yaratilgan testlar yoʻq"
                      description="Yuqorida birinchi original testingizni yarating — eʼlon qilingach, u oʻquvchilarning boʻlimida paydo boʻladi."
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
                            ? t.description || "Task 2 esse topshirigʻi"
                            : t.module === "WRITING_TASK1"
                            ? `${t.description || "Task 1"} · grafik topshiriq`
                            : t.module === "SPEAKING"
                            ? t.description || "Speaking mashq toʻplami"
                            : `${t.description} · ${questionCount(t.data)} ta savol`}
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
                        {t.published ? "Eʼlon qilingan" : "Qoralama"}
                      </span>
                      <form action={deleteGeneratedTest}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          aria-label="Testni oʻchirish"
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
        </details>
      </div>
    </div>
  );
}
