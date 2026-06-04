export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Library, PenTool, BookOpen, Headphones, Mic, BookMarked, GraduationCap } from "lucide-react";
import Link from "next/link";

const MODULES = [
  { key: "ALL", label: "All", icon: Library },
  { key: "WRITING", label: "Writing", icon: PenTool },
  { key: "READING", label: "Reading", icon: BookOpen },
  { key: "LISTENING", label: "Listening", icon: Headphones },
  { key: "SPEAKING", label: "Speaking", icon: Mic },
  { key: "VOCABULARY", label: "Vocabulary", icon: BookMarked },
  { key: "GENERAL", label: "General", icon: GraduationCap },
];

const MODULE_COLORS: Record<string, string> = {
  WRITING: "text-purple-400 border-purple-500/30",
  READING: "text-blue-400 border-blue-500/30",
  LISTENING: "text-green-400 border-green-500/30",
  SPEAKING: "text-orange-400 border-orange-500/30",
  VOCABULARY: "text-averna-pink border-averna-pink/30",
  GENERAL: "text-averna-cyan border-averna-cyan/30",
};

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { module?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const filter = searchParams.module && searchParams.module !== "ALL" ? searchParams.module : null;

  const materials = await db.studyMaterial.findMany({
    where: filter ? { module: filter } : undefined,
    orderBy: [{ module: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Library className="h-8 w-8 text-averna-cyan" />
          IELTS <span className="neon-text-cyan">Materials</span>
        </h1>
        <p className="text-gray-400 mb-6">Curated guides, strategies and word lists for every skill. 📚</p>

        {/* Module filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {MODULES.map((m) => {
            const active = (searchParams.module ?? "ALL") === m.key;
            const Icon = m.icon;
            return (
              <Link key={m.key} href={`/materials?module=${m.key}`}>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active ? "bg-averna-primary text-white border-averna-neon" : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-cyan/40"
                }`}>
                  <Icon className="h-4 w-4" /> {m.label}
                </span>
              </Link>
            );
          })}
        </div>

        {materials.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-400">
              No materials here yet. Try another category, or run <code className="text-averna-cyan">/api/seed</code>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {materials.map((m) => (
              <Card key={m.id} className={`glass ${MODULE_COLORS[m.module] ?? "border-white/10"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${MODULE_COLORS[m.module] ?? "border-white/10 text-gray-300"}`}>
                      {m.module}
                    </span>
                    <span className="text-[10px] text-gray-500">{m.level}</span>
                  </div>
                  <CardTitle className="text-base text-white mt-2">{m.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {m.description && <p className="text-sm text-gray-400">{m.description}</p>}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-averna-neon hover:underline mt-2 inline-block">
                      Open resource →
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
