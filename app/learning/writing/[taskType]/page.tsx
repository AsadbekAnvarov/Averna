export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import WritingEditor from "@/components/learning/writing-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WRITING_PROMPTS } from "@/lib/writing-data";
import { ArrowLeft, PenTool, BookOpen, Sparkles, Lightbulb, ChevronRight } from "lucide-react";

export default async function WritingTaskPage({
  params,
  searchParams,
}: {
  params: { taskType: string };
  searchParams: { p?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const taskType = params.taskType as "task1" | "task2";
  if (!["task1", "task2"].includes(taskType)) {
    redirect("/learning/writing");
  }

  const prompts = WRITING_PROMPTS[taskType];
  const taskConfig = {
    task1: { title: "IELTS Writing Task 1", timeLimit: 20, wordCount: 150, type: "task1" },
    task2: { title: "IELTS Writing Task 2", timeLimit: 40, wordCount: 250, type: "task2" },
  }[taskType];

  // No prompt selected → show list
  if (!searchParams.p) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Link href="/learning/writing" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Writing
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <PenTool className="h-8 w-8 text-averna-purple" /> {taskConfig.title}
          </h1>
          <p className="text-gray-400 mb-8">
            Choose a topic below. Each prompt includes a band 7–8 sample answer, useful phrases and an Uzbek strategy tip you can study before or after writing.
          </p>

          <div className="space-y-4">
            {prompts.map((p) => (
              <Card key={p.id} className="glass border-averna-purple/30 hover:border-averna-neon/40 transition-colors">
                <CardContent className="py-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{p.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/40">
                        {p.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 whitespace-pre-line line-clamp-3">{p.prompt}</p>
                  </div>
                  <Link href={`/learning/writing/${taskType}?p=${p.id}`} className="shrink-0">
                    <Button className="neon-button bg-averna-primary hover:bg-averna-light">
                      Start <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass border-averna-cyan/30 mt-8">
            <CardHeader>
              <CardTitle className="text-averna-cyan flex items-center gap-2">
                <Lightbulb className="h-5 w-5" /> IELTS Band Descriptors — {taskType === "task1" ? "Task 1" : "Task 2"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-300 space-y-2">
              <p>
                <strong className="text-white">Task Achievement / Response:</strong> Cover every part of the prompt, meet the word count, and — for Task 1 — pick the right details rather than listing every number.
              </p>
              <p>
                <strong className="text-white">Coherence &amp; Cohesion:</strong> Clear paragraphs, smooth linking (however, in contrast, as a result), a topic sentence at the start of each body paragraph.
              </p>
              <p>
                <strong className="text-white">Lexical Resource:</strong> Range and precision of vocabulary. Paraphrase the prompt, use synonyms, avoid repeating the same words.
              </p>
              <p>
                <strong className="text-white">Grammatical Range &amp; Accuracy:</strong> Mix simple and complex sentences. A few small errors are fine at band 7; the range matters more than perfection.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Prompt selected → show editor + study panel
  const prompt = prompts.find((p) => p.id === searchParams.p);
  if (!prompt) redirect(`/learning/writing/${taskType}`);

  return (
    <>
      <WritingEditor prompt={prompt} config={taskConfig} userId={session.user.id} />

      <div className="premium-gradient">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <Card className="glass border-averna-neon/30 hover:border-averna-neon/60 transition-colors">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-averna-neon" />
                    <span className="text-white font-semibold">Show Sample Answer, Useful Phrases &amp; Strategy</span>
                    <span className="text-xs text-gray-400">(open only when you have written your own answer or need help)</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-averna-neon group-open:rotate-90 transition-transform" />
                </CardContent>
              </Card>
            </summary>

            <div className="grid lg:grid-cols-2 gap-6 mt-4 pb-8">
              <Card className="glass border-averna-neon/30">
                <CardHeader>
                  <CardTitle className="text-averna-neon flex items-center gap-2">
                    <BookOpen className="h-5 w-5" /> Band 7–8 Sample Answer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-200 whitespace-pre-line leading-relaxed text-sm">{prompt.sampleAnswer}</p>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="glass border-averna-cyan/30">
                  <CardHeader>
                    <CardTitle className="text-averna-cyan">Useful Phrases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {prompt.usefulPhrases.map((phrase, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-averna-cyan">•</span>
                          <span>{phrase}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="glass border-averna-purple/30">
                  <CardHeader>
                    <CardTitle className="text-averna-purple">Strategy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">English</p>
                      <p className="text-gray-200">{prompt.strategyEn}</p>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs uppercase tracking-widest text-averna-neon mb-1">Oʻzbekcha</p>
                      <p className="text-white">{prompt.strategyUz}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
