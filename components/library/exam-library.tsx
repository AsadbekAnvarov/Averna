import Link from "next/link";
import { X } from "lucide-react";
import type { ExamDifficulty, ExamTestSummary } from "@/lib/ielts/types";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { ListeningExamCard, ReadingExamCard } from "./exam-cards";
import { DIFFICULTIES, FilterRow, TYPE_LABEL, hrefWith, matchesType, type ExamTypeFilter, type FilterOption } from "./filters";
import { LibraryEmpty } from "./library-empty";

type Format = "full" | "practice";

export interface ExamLibraryProps {
  skill: "READING" | "LISTENING";
  /** Every test in the library (unfiltered, catalog order). */
  exams: ExamTestSummary[];
  /** Page path, e.g. "/learning/reading". */
  path: string;
  type: ExamTypeFilter;
  difficulty: ExamDifficulty | null;
  /** Query params that encode the current difficulty — kept when switching type. */
  difficultyParams?: Record<string, string | null>;
  /** Shown between the filters and the list (e.g. a recommendation note). */
  notice?: React.ReactNode;
  /** Section copy for full papers and short practice. */
  copy: Record<Format, { title: string; hint: string }>;
  /** Empty-library fallback. */
  empty: { title: string; description: string };
}

/**
 * Filterable Reading / Listening library: URL-driven filter links, a result
 * summary, then Full tests and Short practice sections of cards.
 */
export function ExamLibrary({ skill, exams, path, type, difficulty, difficultyParams = {}, notice, copy, empty }: ExamLibraryProps) {
  const typeParam = type === "all" ? null : type;
  const byDifficulty = difficulty ? exams.filter((e) => e.difficulty === difficulty) : exams;
  const byType = exams.filter((e) => matchesType(e, type));
  const shown = byDifficulty.filter((e) => matchesType(e, type));
  const filtered = type !== "all" || difficulty !== null;

  const typeOptions: FilterOption[] = (["all", "full", "practice"] as ExamTypeFilter[]).map((t) => ({
    key: t,
    label: TYPE_LABEL[t],
    href: hrefWith(path, { type: t === "all" ? null : t, ...difficultyParams }),
    active: type === t,
    count: byDifficulty.filter((e) => matchesType(e, t)).length,
  }));
  const levelOptions: FilterOption[] = [
    { key: "any", label: "Any level", href: hrefWith(path, { type: typeParam }), active: difficulty === null, count: byType.length },
    ...DIFFICULTIES.map((d) => ({
      key: d,
      label: d,
      href: hrefWith(path, { type: typeParam, difficulty: d }),
      active: difficulty === d,
      count: byType.filter((e) => e.difficulty === d).length,
    })),
  ];

  const formats: Format[] = type === "all" ? ["full", "practice"] : [type];
  const groups = formats
    .map((f) => ({ key: f, ...copy[f], items: shown.filter((e) => matchesType(e, f)) }))
    .filter((g) => g.items.length > 0);

  if (exams.length === 0) {
    return (
      <LibraryEmpty
        title={empty.title}
        description={empty.description}
        action={{ href: "/learning", label: "Back to the Learning Center" }}
      />
    );
  }

  return (
    <>
      <Reveal as="section" aria-label="Filter tests" className="av-panel mb-5 space-y-3 rounded-2xl p-4 sm:p-5">
        <FilterRow label="Type" options={typeOptions} />
        <FilterRow label="Level" options={levelOptions} />
      </Reveal>

      {notice}

      <p aria-live="polite" className="mb-4 flex min-h-[44px] flex-wrap items-center gap-x-4 text-sm text-gray-400">
        <span>
          Showing <span className="font-semibold text-white">{shown.length}</span> of {exams.length}{" "}
          {exams.length === 1 ? "test" : "tests"}
        </span>
        {filtered && (
          <Link href={path} scroll={false} className="inline-flex min-h-[44px] items-center gap-1 text-averna-neon hover:underline">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </Link>
        )}
      </p>

      {groups.length === 0 ? (
        <LibraryEmpty
          title="No tests match these filters"
          description="Try another level or format — or show every test in the library."
          action={{ href: path, label: "Show all tests" }}
        />
      ) : (
        groups.map((g) => {
          const headingId = `${skill.toLowerCase()}-${g.key}-heading`;
          return (
            <section key={g.key} aria-labelledby={headingId} className="mb-10">
              <Reveal className="mb-4">
                <h2 id={headingId} className="flex items-baseline gap-2 text-lg font-semibold text-white">
                  {g.title}
                  <span className="text-sm font-normal tabular-nums text-gray-500">{g.items.length}</span>
                </h2>
                <p className="mt-0.5 text-sm text-gray-400">{g.hint}</p>
              </Reveal>
              <RevealGroup as="ul" role="list" className="grid gap-4 md:grid-cols-2">
                {g.items.map((e) =>
                  skill === "READING" ? (
                    <ReadingExamCard key={`${e.source}-${e.id}`} exam={e} />
                  ) : (
                    <ListeningExamCard key={`${e.source}-${e.id}`} exam={e} />
                  )
                )}
              </RevealGroup>
            </section>
          );
        })
      )}
    </>
  );
}
