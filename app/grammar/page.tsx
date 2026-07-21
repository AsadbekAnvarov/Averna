export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import {
  BookOpen, Layers, Clock, Hash, GitBranch, Link2, ListChecks, Lightbulb,
} from "lucide-react";

type Topic = {
  title: string;
  why: string;
  icon: any;
  accent: string; // e.g. "text-averna-purple"
  chip: string; // e.g. "bg-averna-purple/15 text-averna-purple"
  wrong: string;
  right: string;
  tip: string;
};

const TOPICS: Topic[] = [
  {
    title: "Complex Sentences",
    why: "The single biggest lever for the “Grammatical Range” band — mix simple, compound and complex sentences.",
    icon: GitBranch,
    accent: "text-averna-purple",
    chip: "bg-averna-purple/15 text-averna-purple",
    wrong: "Cars cause pollution. The government should act.",
    right: "Because cars cause serious pollution, the government should act decisively.",
    tip: "Aim for at least one subordinate clause (because, although, which, while) per paragraph in Writing Task 2.",
  },
  {
    title: "Verb Tenses",
    why: "Accurate, consistent tenses signal control. Present perfect is ideal for describing trends over time.",
    icon: Clock,
    accent: "text-averna-cyan",
    chip: "bg-averna-cyan/15 text-averna-cyan",
    wrong: "The number of users increase since 2010.",
    right: "The number of users has increased since 2010.",
    tip: "For Task 1 trends use present perfect (has risen) or past simple with a fixed date (rose in 2010).",
  },
  {
    title: "Articles (a / an / the)",
    why: "One of the most frequent errors for learners — small words, real band impact.",
    icon: Hash,
    accent: "text-emerald-400",
    chip: "bg-emerald-400/15 text-emerald-400",
    wrong: "She is best student in the class and wants to be engineer.",
    right: "She is the best student in the class and wants to be an engineer.",
    tip: "Use “the” for something specific/unique; “a/an” to introduce something new; no article for general plurals.",
  },
  {
    title: "Conditionals",
    why: "Essential for Speaking Part 3 and opinion essays where you discuss hypotheticals and consequences.",
    icon: GitBranch,
    accent: "text-orange-400",
    chip: "bg-orange-400/15 text-orange-400",
    wrong: "If governments would invest more, pollution will decrease.",
    right: "If governments invested more, pollution would decrease.",
    tip: "2nd conditional = if + past simple, would + base verb (for unreal/hypothetical present situations).",
  },
  {
    title: "Subject–Verb Agreement",
    why: "Errors here are highly visible and drag down accuracy across the whole answer.",
    icon: ListChecks,
    accent: "text-averna-pink",
    chip: "bg-averna-pink/15 text-averna-pink",
    wrong: "The list of problems are growing every year.",
    right: "The list of problems is growing every year.",
    tip: "The verb agrees with the head noun (list), not the noun closest to it (problems).",
  },
  {
    title: "Punctuation & Linking",
    why: "Correct commas and cohesive devices make your ideas flow — a core part of Coherence & Cohesion.",
    icon: Link2,
    accent: "text-averna-blue",
    chip: "bg-averna-blue/15 text-averna-blue",
    wrong: "Firstly technology is helpful however it can be harmful.",
    right: "Firstly, technology is helpful; however, it can be harmful.",
    tip: "Follow sentence-initial linkers (However, Moreover, In addition) with a comma.",
  },
];

export default async function GrammarPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/learning", label: "Back to Learning Center" }}
          icon={BookOpen}
          iconClassName="text-averna-purple"
          title={<>IELTS <span className="neon-text">Grammar</span></>}
          subtitle="Focused grammar essentials mapped to the IELTS band descriptors. Master these to lift your Writing and Speaking scores."
        />

        <SectionHeader icon={Layers} title="Grammar Essentials" subtitle="Six high-impact focus areas" accent="text-averna-purple" />
        <div className="grid md:grid-cols-2 gap-5">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <article
                key={t.title}
                className="glass rounded-2xl border border-white/5 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white">{t.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{t.why}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="flex gap-2 text-red-300/90">
                    <span aria-hidden className="select-none">✗</span>
                    <span>{t.wrong}</span>
                  </p>
                  <p className="flex gap-2 text-emerald-300">
                    <span aria-hidden className="select-none">✓</span>
                    <span>{t.right}</span>
                  </p>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 p-3">
                  <Lightbulb className={`h-4 w-4 shrink-0 mt-0.5 ${t.accent}`} />
                  <p className="text-xs text-gray-300">{t.tip}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 glass rounded-2xl border border-white/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Ready to apply it?</p>
            <p className="text-sm text-gray-400">Practise these structures in a real Writing task and get AI feedback.</p>
          </div>
          <Link
            href="/learning/writing"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-averna-primary hover:bg-averna-light text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Practise Writing
          </Link>
        </div>
      </div>
    </div>
  );
}
