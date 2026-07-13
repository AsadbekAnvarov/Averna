export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Headphones, BookOpen, PenTool, Play, Shuffle, Sparkles } from "lucide-react";
import Link from "next/link";
import { MOCK_EXAMS, pickRandomMockExamId, type MockDifficulty } from "@/lib/mock-exams-data";

const DIFF_PILL: Record<MockDifficulty, string> = {
  Easy: "text-averna-neon border-averna-neon/40 bg-averna-neon/10",
  Medium: "text-averna-cyan border-averna-cyan/40 bg-averna-cyan/10",
  Hard: "text-averna-pink border-averna-pink/40 bg-averna-pink/10",
};

const CARD_BORDER: Record<MockDifficulty, string> = {
  Easy: "border-averna-neon/30",
  Medium: "border-averna-cyan/30",
  Hard: "border-averna-pink/30",
};

export default async function MockExamPickerPage({
  searchParams,
}: {
  searchParams: { random?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // "Random exam" button target — resolved server-side on click, then bounces to the exam page
  if (searchParams.random === "1") {
    redirect(`/learning/mock-exam/${pickRandomMockExamId()}`);
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-2 block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-400" />
            Mock IELTS <span className="neon-text">Exams</span>
          </h1>
          <p className="text-gray-300">
            Choose one of {MOCK_EXAMS.length} themed mini-mocks. Each covers Listening, Reading and Writing
            with an estimated overall band at the end.
          </p>
        </div>

        {/* How It Works */}
        <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-averna-neon flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> How It Works
            </CardTitle>
            <CardDescription>Realistic mini-mocks — pick a theme or hit the shuffle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-3">
                <Headphones className="h-6 w-6 mx-auto text-averna-cyan mb-2" />
                <p className="text-sm text-white font-semibold">Listening</p>
                <p className="text-xs text-gray-400 mt-1">5 questions · audio read aloud</p>
              </div>
              <div className="text-center p-3">
                <BookOpen className="h-6 w-6 mx-auto text-averna-purple mb-2" />
                <p className="text-sm text-white font-semibold">Reading</p>
                <p className="text-xs text-gray-400 mt-1">5 questions on a themed passage</p>
              </div>
              <div className="text-center p-3">
                <PenTool className="h-6 w-6 mx-auto text-averna-pink mb-2" />
                <p className="text-sm text-white font-semibold">Writing</p>
                <p className="text-xs text-gray-400 mt-1">Task-2 essay, 250+ words</p>
              </div>
              <div className="text-center p-3">
                <Trophy className="h-6 w-6 mx-auto text-yellow-400 mb-2" />
                <p className="text-sm text-white font-semibold">Overall Band</p>
                <p className="text-xs text-gray-400 mt-1">Instant estimate + points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Random exam */}
        <div className="mb-6 flex flex-wrap items-center gap-3 animate-fade-in">
          <Link href="/learning/mock-exam?random=1">
            <Button className="neon-button bg-averna-primary hover:bg-averna-light">
              <Shuffle className="mr-2 h-4 w-4" /> Random Exam
            </Button>
          </Link>
          <span className="text-xs text-gray-400">
            Not sure which to pick? Let us shuffle one for you.
          </span>
        </div>

        {/* Exam grid */}
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-2xl font-bold text-white">Available Exams</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {MOCK_EXAMS.map((exam) => (
              <Card
                key={exam.id}
                className={`glass ${CARD_BORDER[exam.difficulty]} hover:shadow-neon-green transition-all duration-300`}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white leading-tight">{exam.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${DIFF_PILL[exam.difficulty]}`}>
                      {exam.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-averna-neon mb-3">{exam.theme}</p>
                  <p className="text-sm text-gray-300 mb-4 flex-1">{exam.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {exam.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Headphones className="h-3.5 w-3.5" /> {exam.listening.questions.length} Qs
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> {exam.reading.questions.length} Qs
                    </span>
                    <span className="flex items-center gap-1">
                      <PenTool className="h-3.5 w-3.5" /> essay
                    </span>
                  </div>
                  <Link href={`/learning/mock-exam/${exam.id}`}>
                    <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                      <Play className="mr-2 h-4 w-4" /> Start Exam
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Tip */}
        <Card className="glass border-white/10 mt-8 animate-fade-in">
          <CardContent className="py-4">
            <p className="text-xs text-gray-400">
              💡 Tip: your band estimate saves to your progress, so you can track improvement across
              different themes. Points are only awarded for genuine attempts.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
