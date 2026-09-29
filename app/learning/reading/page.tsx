export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listReadingExams } from "@/lib/ielts/catalog";
import type { ExamTestSummary } from "@/lib/ielts/types";
import { Reveal } from "@/components/motion/reveal";
import { LibraryHero } from "@/components/library/library-hero";
import { ExamLibrary } from "@/components/library/exam-library";
import { ScoreGuide } from "@/components/library/score-guide";
import { parseDifficulty, parseTypeFilter, type SearchParams } from "@/components/library/filters";

const PATH = "/learning/reading";

export default async function ReadingLibraryPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const type = parseTypeFilter(searchParams.type);
  const difficulty = parseDifficulty(searchParams.difficulty ?? searchParams.level);

  const exams = await listReadingExams().catch((): ExamTestSummary[] => []);
  const full = exams.filter((e) => e.full).length;
  const practice = exams.length - full;

  const facts = [
    full > 0 ? `${full} full ${full === 1 ? "test" : "tests"}` : null,
    practice > 0 ? `${practice} short practice` : null,
    "3 passages · 40 questions · 60 min",
    "About 20 min per passage",
  ].filter((f): f is string => !!f);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <LibraryHero
          skill="READING"
          eyebrow="Academic Reading"
          title="Reading tests"
          subtitle="Full Academic papers in the computer-delivered format, or one passage at a time when you have 20 minutes. Every test is marked instantly and converted to a band."
          facts={facts}
        />

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
