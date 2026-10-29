export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { libraryCount } from "@/lib/articles/library";
import { auth } from "@/lib/auth";
import { listReadingExams } from "@/lib/ielts/catalog";
import type { ExamTestSummary } from "@/lib/ielts/types";
import { Reveal } from "@/components/motion/reveal";
import { LibraryHero } from "@/components/library/library-hero";
import { ExamLibrary } from "@/components/library/exam-library";
import { ScoreGuide } from "@/components/library/score-guide";
import { parseDifficulty, parseTypeFilter, type SearchParams } from "@/components/library/filters";

const PATH = "/learning/reading";

export default async function ReadingLibraryPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? {};
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const type = parseTypeFilter(searchParams.type);
  const difficulty = parseDifficulty(searchParams.difficulty ?? searchParams.level);

  const exams = await listReadingExams().catch((): ExamTestSummary[] => []);
  const full = exams.filter((e) => e.full).length;
  const practice = exams.length - full;
  const articleCount = libraryCount();

  const facts = [
    full > 0 ? `${full} full ${full === 1 ? "test" : "tests"}` : null,
    practice > 0 ? `${practice} short practice` : null,
    "3 passages · 40 questions · 60 min",
    "About 20 min per passage",
  ].filter((f): f is string => !!f);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-4 pb-8 sm:py-6 lg:pb-6">
        <LibraryHero
          skill="READING"
          eyebrow="Academic Reading"
          title="Reading tests"
          subtitle="Full Academic papers in the computer-delivered format, or one passage at a time when you have 20 minutes. Every test is marked instantly and converted to a band."
          facts={facts}
        />

        <Link
          href="/article"
          className="glass mb-4 flex min-h-[44px] items-center gap-3 rounded-2xl border border-averna-cyan/30 px-4 py-3 text-white transition-colors hover:border-averna-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan"
        >
          <Newspaper className="h-5 w-5 shrink-0 text-averna-cyan" aria-hidden />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Articles</span>
            <span className="text-gray-300"> · {articleCount} {articleCount === 1 ? "lesson" : "lessons"} to read and learn words</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
        </Link>

        <ExamLibrary
          skill="READING"
          exams={exams}
          path={PATH}
          type={type}
          difficulty={difficulty}
          difficultyParams={{ difficulty }}
          copy={{
            full: { title: "Full Academic tests", hint: "3 passages · 40 questions · 60 minutes — exactly like test day" },
            practice: { title: "Short practice", hint: "Shorter papers for a focused session" },
          }}
          empty={{
            title: "Reading tests are on the way",
            description: "New papers are being prepared. Check back soon — or practise vocabulary and grammar in the meantime.",
          }}
        />

        <Reveal>
          <ScoreGuide skill="READING" />
        </Reveal>
      </div>
    </div>
  );
}
