export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, FileText, Clock, Target, ArrowRight, Scale, Shuffle, Timer } from "lucide-react";
import Link from "next/link";
import { SpotlightCard } from "@/components/motion/spotlight-card";

export default async function WritingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const tasks = [
    {
      id: "task1",
      type: "Task 1",
      title: "Academic Writing Task 1",
      description: "Describe visual information (graphs, charts, diagrams) in at least 150 words.",
      timeLimit: 20,
      wordCount: 150,
      icon: "📊",
      color: "purple",
    },
    {
      id: "task2",
      type: "Task 2",
      title: "Academic Writing Task 2",
      description: "Write an essay in response to a point of view, argument or problem in at least 250 words.",
      timeLimit: 40,
      wordCount: 250,
      icon: "📝",
      color: "blue",
    },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-2 block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <PenTool className="h-10 w-10 text-purple-400" />
            IELTS Writing
          </h1>
          <p className="text-gray-300">
            Practice Academic Writing with AI-powered feedback and band score estimation
          </p>
        </div>

        {/* Full Writing test (exam format) */}
        <SpotlightCard
          as="section"
          aria-labelledby="full-writing-test-title"
          className="av-panel av-panel-hero glow-hover mb-8 rounded-3xl p-5 animate-fade-in sm:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-neon/10 text-averna-neon" aria-hidden>
                  <Timer className="h-5 w-5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Exam format</p>
              </div>
              <h2 id="full-writing-test-title" className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Full Writing test
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-300 sm:text-base">
                <span>Task 1 + Task 2</span>
                <span aria-hidden className="text-gray-500">·</span>
                <span>60 minutes</span>
                <span aria-hidden className="text-gray-500">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Shuffle className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
                  new tasks every time
                </span>
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
                Write both tasks in one timed sitting, just like the computer-delivered IELTS, and get your overall
                Writing band.
              </p>
              <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl border border-averna-cyan/20 bg-averna-cyan/[0.06] px-3 py-2.5 text-sm leading-snug text-gray-200">
                <Scale className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
                <span>
                  Task 2 counts double: your band is (Task 1 + 2 × Task 2) ÷ 3, rounded to the nearest half band — so
                  give Task 2 about 40 minutes.
                </span>
              </p>
              <ul role="list" aria-label="Test format" className="mt-4 flex flex-wrap gap-2">
                <li className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  Task 1 · about 20 min · 150+ words
                </li>
                <li className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  Task 2 · about 40 min · 250+ words
                </li>
              </ul>
            </div>
            <Link
              href="/learning/writing/exam"
              prefetch={false}
              className="glow-cta inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
            >
              Start the full test
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </SpotlightCard>

        {/* Overview Card */}
        <Card className="glass border-purple-500/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-purple-400">How It Works</CardTitle>
            <CardDescription>Get instant AI feedback on your writing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="text-sm text-white font-semibold">Choose Task Type</p>
                <p className="text-xs text-gray-400 mt-1">Task 1 or Task 2</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="text-sm text-white font-semibold">Write Your Essay</p>
                <p className="text-xs text-gray-400 mt-1">Use the timer and word counter</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">3️⃣</div>
                <p className="text-sm text-white font-semibold">AI Analysis</p>
                <p className="text-xs text-gray-400 mt-1">Get detailed feedback</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">4️⃣</div>
                <p className="text-sm text-white font-semibold">Improve & Retry</p>
                <p className="text-xs text-gray-400 mt-1">Practice makes perfect</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`glass border-${task.color}-500/30 hover:shadow-neon-green transition-all duration-300 hover:scale-105`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">{task.icon}</span>
                    {task.type}
                  </CardTitle>
                  <span className={`text-xs px-3 py-1 rounded-full bg-${task.color}-500/20 text-${task.color}-400 border border-${task.color}-500/30`}>
                    {task.timeLimit} min
                  </span>
                </div>
                <CardDescription className="mt-2">{task.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-300">{task.description}</p>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>{task.timeLimit} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span>{task.wordCount}+ words</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Target className="h-4 w-4" />
                    <span>AI Feedback</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-averna-primary/20">
                  <Link href={`/learning/writing/${task.id}`}>
                    <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                      Start {task.type}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Assessment Info */}
        <Card className="glass border-averna-primary/30 mt-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-averna-neon">AI Assessment Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Scoring Criteria:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Task Achievement:</strong> How well you address the task</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Coherence & Cohesion:</strong> Organization and flow</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Lexical Resource:</strong> Vocabulary range and accuracy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Grammar:</strong> Range and accuracy of structures</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-white">You'll Receive:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">🎯</span>
                    <span>Estimated IELTS Band Score (0-9)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">💪</span>
                    <span>Detailed strengths and weaknesses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">📚</span>
                    <span>Personalized recommendations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">🤖</span>
                    <span>AI-generated content detection</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
