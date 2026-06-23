export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Library, PenTool, BookOpen, Headphones, Mic, BookMarked, GraduationCap, Search, X } from "lucide-react";
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

const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];

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
  searchParams: { module?: string; level?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const moduleParam = searchParams.module && searchParams.module !== "ALL" ? searchParams.module : null;
  const levelParam = searchParams.level && searchParams.level !== "All" ? searchParams.level : null;
  const q = (searchParams.q ?? "").trim();

  const materials = await db.studyMaterial.findMany({
    where: {
      ...(moduleParam ? { module: moduleParam } : {}),
      ...(levelParam ? { level: levelParam } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ module: "asc" }, { createdAt: "desc" }],
  });

  // Build a query string preserving the other active filters
  const buildHref = (overrides: { module?: string; level?: string; q?: string }) => {
    const params = new URLSearchParams();
    const mod = overrides.module ?? searchParams.module ?? "ALL";
    const lvl = overrides.level ?? searchParams.level ?? "All";
    const query = overrides.q ?? q;
    if (mod && mod !== "ALL") params.set("module", mod);
    if (lvl && lvl !== "All") params.set("level", lvl);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/materials?${s}` : "/materials";
  };

  const activeModule = searchParams.module ?? "ALL";
  const activeLevel = searchParams.level ?? "All";
  const hasFilters = !!moduleParam || !!levelParam || !!q;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Library className="h-8 w-8 text-averna-cyan" />
          IELTS <span className="neon-text-cyan">Materials</span>
        </h1>
        <p className="text-gray-400 mb-6">Curated guides, strategies and word lists for every skill. 📚</p>

        {/* Search */}
        <form method="get" className="mb-4">
          {moduleParam && <input type="hidden" name="module" value={moduleParam} />}
          {levelParam && <input type="hidden" name="level" value={levelParam} />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search materials by title or topic…"
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
            />
          </div>
        </form>

        {/* Module filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {MODULES.map((m) => {
            const active = activeModule === m.key;
            const Icon = m.icon;
            return (
              <Link key={m.key} href={buildHref({ module: m.key })}>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active ? "bg-averna-primary text-white border-averna-neon" : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-cyan/40"
                }`}>
                  <Icon className="h-4 w-4" /> {m.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Level filter */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-gray-500 mr-1">Level:</span>
          {LEVELS.map((lvl) => {
            const active = activeLevel === lvl;
            return (
              <Link key={lvl} href={buildHref({ level: lvl })}>
                <span className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  active ? "bg-averna-purple/20 text-averna-purple border-averna-purple/40" : "bg-white/5 border-white/10 text-gray-400 hover:border-averna-purple/40"
                }`}>
                  {lvl}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            {materials.length} result{materials.length === 1 ? "" : "s"}
            {q && <> for &ldquo;<span className="text-white">{q}</span>&rdquo;</>}
          </p>
          {hasFilters && (
            <Link href="/materials" className="text-xs text-averna-cyan hover:underline inline-flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Clear filters
            </Link>
          )}
        </div>

        {materials.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-400">
              No materials match your filters. Try a different search or category.
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
