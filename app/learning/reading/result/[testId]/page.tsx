export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, CheckCircle, XCircle, ArrowLeft, RotateCcw, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { ReadingQuestion } from "@/lib/reading-tests-data";
import { getReadingTest } from "@/lib/reading-content";
import { NextStepCard } from "@/components/learning/next-step-card";
import { ResultCelebration } from "@/components/learning/result-celebration";

function formatAnswer(ans: any, type: string, options?: string[]) {
  if (ans === undefined || ans === null || ans === "") return "—";
  if (type === "multiple-choice" && options) {
    const idx = typeof ans === "number" ? ans : parseInt(ans, 10);
    return Number.isFinite(idx) && options[idx] !== undefined ? options[idx] : String(ans);
  }
  if (type === "true-false-not-given") return String(ans).replace(/-/g, " ");
  return String(ans);
}

function QuestionReview({
  q,
  qNum,
  studentAns,
  isCorrect,
}: {
  q: ReadingQuestion;
  qNum: number;
  studentAns: any;
  isCorrect: boolean;
}) {
  const missing = studentAns === undefined || studentAns === null || studentAns === "";
  return (
    <div
      className={`p-4 rounded-lg border ${
        isCorrect ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-white font-medium flex-1">
          {qNum}. {q.question}
        </p>
        {isCorrect ? (
          <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
        )}
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-gray-400">
          Your answer:{" "}
          {missing ? (
            <em className="text-gray-500">No answer</em>
          ) : (
            <span className={isCorrect ? "text-green-300 font-medium" : "text-red-300 font-medium"}>
              {formatAnswer(studentAns, q.type, q.options)}
            </span>
          )}
        </p>
        {!isCorrect && (
          <p className="text-gray-400">
            Correct answer:{" "}
            <span className="text-green-300 font-medium">
              {formatAnswer(q.correctAnswer, q.type, q.options)}
            </span>
          </p>
        )}
        {q.explanation && (
          <div className="mt-3 border-l-2 border-averna-cyan/40 pl-3 py-1 bg-averna-cyan/5 rounded-r-md">
            <p className="text-averna-cyan text-[10px] uppercase tracking-wider flex items-center gap-1 mb-0.5">
              <Sparkles className="h-3 w-3" /> Why
            </p>
            <p className="text-gray-200 text-sm">{q.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReadingResultPage({ params }: { params: { testId: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) redirect("/auth/signin");

  const test = await db.iELTSTest.findUnique({
    where: { id: params.testId },
    include: { student: { include: { user: true } } },
  });

  if (!test || test.studentId !== student.id) redirect("/learning/reading");

  const analysis = test.aiAnalysis as any;
  const raw = test.answers as any;
  const savedAnswers: Record<string, any> = raw?.answers ?? {};
  const results: Record<string, boolean> = raw?.results ?? {};
  const sourceTestId: string | undefined = raw?.testId;
  const testData = sourceTestId ? await getReadingTest(sourceTestId) : undefined;

  const getBandColor = (band: number) => {
    if (band >= 8) return "text-green-400";
    if (band >= 7) return "text-blue-400";
    if (band >= 6) return "text-yellow-400";
    return "text-orange-400";
  };

  const targetNum = student.targetBand ? parseFloat(String(student.targetBand).replace(/[^0-9.]/g, "")) : NaN;
  const target = Number.isFinite(targetNum) ? targetNum : null;

  return (
    <div className="min-h-screen premium-gradient">
      <ResultCelebration score={test.score} target={target} />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <Link href="/learning/reading" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Reading
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Reading Test Results</h1>
          <p className="text-gray-400">
            {testData ? `${testData.title} · ${testData.description}` : "Your performance analysis"}
          </p>
        </div>

        {/* Band Score */}
        <Card className="glass border-blue-500/30 mb-8 animate-fade-in">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">IELTS Reading Band Score</p>
              <div className={`text-7xl font-bold mb-2 inline-block animate-pop ${getBandColor(test.score)}`}>
                {test.score.toFixed(1)}
              </div>
              <p className="text-xl text-gray-300 mb-4">
                {analysis.correctCount} / {analysis.totalQuestions} correct ({analysis.percentage.toFixed(1)}%)
              </p>
              <Progress value={analysis.percentage} className="h-3 max-w-md mx-auto" />
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-averna-neon">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">{analysis.correctCount}</p>
                <p className="text-sm text-gray-400">Correct</p>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-400">
                  {analysis.totalQuestions - analysis.correctCount}
                </p>
                <p className="text-sm text-gray-400">Incorrect</p>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <Trophy className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-400">{test.score.toFixed(1)}</p>
                <p className="text-sm text-gray-400">Band Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-passage question review */}
        {testData ? (
          <div className="space-y-6 mb-8 animate-fade-in">
            <div className="flex items-center gap-2 text-averna-cyan">
              <BookOpen className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Question Review</h2>
              <span className="text-xs text-gray-500 ml-2">Read the "Why" note under each incorrect answer to learn from it.</span>
            </div>
            {testData.passages.map((p, pIdx) => {
              let qNum = 0;
              for (let i = 0; i < pIdx; i++) qNum += testData.passages[i].questions.length;
              return (
                <Card key={p.id} className="glass border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 text-lg">
                      Passage {pIdx + 1}: {p.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.questions.map((q, qIdx) => {
                      const studentAns = savedAnswers[q.id];
                      const isCorrect = results[q.id] === true;
                      return (
                        <QuestionReview
                          key={q.id}
                          q={q}
                          qNum={qNum + qIdx + 1}
                          studentAns={studentAns}
                          isCorrect={isCorrect}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          // Fallback for older submissions without stored testId
          <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
            <CardHeader>
              <CardTitle>Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(results).map(([questionId, isCorrect]: [string, any]) => (
                  <div
                    key={questionId}
                    className={`p-3 rounded-lg border ${
                      isCorrect ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        Question {questionId.replace("q", "")}
                      </span>
                      {isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* What's next */}
        <NextStepCard studentId={student.id} completedLabel="Reading" completedScore={test.score} />

        {/* Actions */}
        <div className="flex gap-4 mt-8 animate-fade-in">
          <Link href="/learning/reading" className="flex-1">
            <Button className="w-full neon-button bg-blue-500 hover:bg-blue-600">
              <RotateCcw className="mr-2 h-4 w-4" />
              Take Another Test
            </Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full border-averna-neon text-averna-neon">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
