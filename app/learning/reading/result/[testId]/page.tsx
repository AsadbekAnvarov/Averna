import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, CheckCircle, XCircle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";

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
  const results = test.answers as any;

  const getBandColor = (band: number) => {
    if (band >= 8) return "text-green-400";
    if (band >= 7) return "text-blue-400";
    if (band >= 6) return "text-yellow-400";
    return "text-orange-400";
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <Link href="/learning/reading" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Reading
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Reading Test Results</h1>
          <p className="text-gray-400">Your performance analysis</p>
        </div>

        {/* Band Score */}
        <Card className="glass border-blue-500/30 mb-8 animate-fade-in">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">IELTS Reading Band Score</p>
              <div className={`text-7xl font-bold mb-2 ${getBandColor(test.score)}`}>
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

        {/* Question Review */}
        <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(results.results || {}).map(([questionId, isCorrect]: [string, any]) => (
                <div
                  key={questionId}
                  className={`p-3 rounded-lg border ${
                    isCorrect
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
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

        {/* Actions */}
        <div className="flex gap-4 animate-fade-in">
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
