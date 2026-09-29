export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Headphones, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { listListeningExams } from "@/lib/ielts/catalog";
import type { ExamTestSummary } from "@/lib/ielts/types";
import { Reveal } from "@/components/motion/reveal";
import { LibraryHero } from "@/components/library/library-hero";
import { ExamLibrary } from "@/components/library/exam-library";
import { ScoreGuide } from "@/components/library/score-guide";
import { hrefWith, parseDifficulty, parseTypeFilter, type SearchParams } from "@/components/library/filters";

const PATH = "/learning/listening";

export default async function ListeningLibraryPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const type = parseTypeFilter(searchParams.type);
  // ?level= comes from Averna's recommendation; ?difficulty= from the filters here.
  const chosen = parseDifficulty(searchParams.difficulty);
  const recommended = chosen ? null : parseDifficulty(searchParams.level);

  const exams = await listListeningExams().catch((): ExamTestSummary[] => []);
  const full = exams.filter((e) => e.full).length;
  const practice = exams.length - full;

  // Pre-filter to the recommended level — unless the library has none at that level yet.
  const recommendedAvailable = !!recommended && exams.some((e) => e.difficulty === recommended);
  const difficulty = chosen ?? (recommendedAvailable ? recommended : null);

  const facts = [
    full > 0 ? `${full} full ${full === 1 ? "test" : "tests"}` : null,
    practice > 0 ? `${practice} short practice` : null,
    "4 parts · 40 questions · ~30 min",
    "Practise one part at a time",
  ].filter((f): f is string => !!f);

  const notice = recommended ? (
    <Reveal className="mb-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3 text-sm text-gray-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
          <span>
            Averna recommends <span className="font-semibold text-white">{recommended}</span> tests for your current level.
            {!recommendedAvailable && " None are in the library yet, so every level is shown."}
          </span>
        </p>
        {recommendedAvailable && (
          <Link
            href={hrefWith(PATH, { type: type === "all" ? null : type })}
            scroll={false}
            className="glow-hover inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-300 transition-colors hover:text-white"
          >
            Show all levels
          </Link>
        )}
      </div>
    </Reveal>
  ) : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <LibraryHero
          skill="LISTENING"
          eyebrow="IELTS Listening"
          title="Listening tests"
          subtitle="Four recordings, forty questions — the real test from start to finish, or one part at a time. Answers are marked instantly and converted to a band."
          facts={facts}
        >
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-averna-purple/20 bg-averna-purple/[0.06] p-4">
            <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-averna-purple" aria-hidden />
            <p className="text-sm leading-relaxed text-gray-300">
              <span className="font-semibold text-white">Use headphones in a quiet room.</span> Practice lets you pause and
              replay; in the mock exam each recording plays once, just like test day.
            </p>
          </div>
        </LibraryHero>

        <ExamLibrary
          skill="LISTENING"
          exams={exams}
          path={PATH}
          type={type}
          difficulty={difficulty}
          difficultyParams={chosen ? { difficulty: chosen } : { level: recommendedAvailable ? recommended : null }}
          notice={notice}
          copy={{
            full: { title: "Full Listening tests", hint: "4 parts · 40 questions · about 30 minutes plus time to check" },
            practice: { title: "Short practice", hint: "Shorter recordings for a quick, focused session" },
          }}
          empty={{
            title: "Listening tests are on the way",
            description: "New recordings are being prepared. Check back soon — or train your ear with pronunciation practice.",
          }}
        />

        <Reveal>
          <ScoreGuide skill="LISTENING" />
        </Reveal>
      </div>
    </div>
  );
}
