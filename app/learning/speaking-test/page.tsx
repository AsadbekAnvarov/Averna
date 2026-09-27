export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, Mic } from "lucide-react";
import { auth } from "@/lib/auth";
import { listSpeakingSets, type SpeakingSetSummary } from "@/lib/ielts/catalog";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { LibraryHero } from "@/components/library/library-hero";
import { SpeakingSetCard } from "@/components/library/exam-cards";
import { LibraryEmpty } from "@/components/library/library-empty";

const PARTS = [
  { n: 1, title: "Interview", time: "4–5 min", text: "Short questions about familiar topics — home, work, studies, interests." },
  { n: 2, title: "Long turn", time: "3–4 min", text: "A cue card: 1 minute to prepare, then speak for up to 2 minutes." },
  { n: 3, title: "Discussion", time: "4–5 min", text: "Deeper, more abstract questions linked to the Part 2 topic." },
];

export default async function SpeakingLibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const sets = await listSpeakingSets().catch((): SpeakingSetSummary[] => []);

  const facts = [
    sets.length > 0 ? `${sets.length} full ${sets.length === 1 ? "test" : "tests"}` : null,
    "3 parts · 11–14 min",
    "1 min to prepare Part 2",
  ].filter((f): f is string => !!f);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-24 sm:py-8 lg:pb-8">
        <LibraryHero
          skill="SPEAKING"
          eyebrow="IELTS Speaking"
          title="Speaking tests"
          subtitle="A complete examiner-style interview in three parts, timed like the real test. Find a quiet place and allow microphone access when your browser asks."
          facts={facts}
        />

        <Reveal as="section" aria-labelledby="speaking-parts-heading" className="mb-8">
          <h2 id="speaking-parts-heading" className="sr-only">
            How the Speaking test works
          </h2>
          <ol role="list" className="grid gap-3 sm:grid-cols-3">
            {PARTS.map((p) => (
              <li key={p.n} className="av-panel rounded-2xl p-4">
                <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <span className="text-amber-300">Part {p.n}</span>
                  <span className="font-medium normal-case tracking-normal text-gray-500">{p.time}</span>
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{p.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <section aria-labelledby="speaking-sets-heading" className="mb-10">
          <Reveal className="mb-4">
            <h2 id="speaking-sets-heading" className="flex items-baseline gap-2 text-lg font-semibold text-white">
              Full Speaking tests
              {sets.length > 0 && <span className="text-sm font-normal tabular-nums text-gray-500">{sets.length}</span>}
            </h2>
            <p className="mt-0.5 text-sm text-gray-400">Each test: Part 1 topics, one cue card and a linked discussion.</p>
          </Reveal>

          {sets.length === 0 ? (
            <LibraryEmpty
              icon={Mic}
              title="Speaking tests are on the way"
              description="New tests are being prepared. Meanwhile, answer a single examiner question and get an instant band estimate."
              action={{ href: "/learning/examiner", label: "Try the quick examiner" }}
              secondary={{ href: "/learning", label: "Back to the Learning Center" }}
            />
          ) : (
            <RevealGroup as="ul" role="list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sets.map((s) => (
                <SpeakingSetCard key={`${s.source}-${s.id}`} set={s} />
              ))}
            </RevealGroup>
          )}
        </section>

        {sets.length > 0 && (
          <Reveal>
            <Link
              href="/learning/examiner"
              className="av-panel glow-hover group flex min-h-[44px] items-center gap-4 rounded-2xl p-4 sm:p-5"
            >
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-cyan/10 text-averna-cyan">
                <Bot className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white sm:text-base">Short on time? Try the quick examiner</span>
                <span className="block text-xs text-gray-400 sm:text-sm">
                  Answer one question out loud and get an instant band estimate.
                </span>
              </span>
              <ArrowRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-averna-neon motion-reduce:transition-none"
              />
            </Link>
          </Reveal>
        )}
      </div>
    </div>
  );
}
