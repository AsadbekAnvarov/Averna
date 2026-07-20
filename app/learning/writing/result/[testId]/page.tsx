export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown, AlertCircle, CheckCircle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { NextStepCard } from "@/components/learning/next-step-card";

export default async function WritingResultPage({
  params,
}: {
  params: { testId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
  });

  if (!student) redirect("/auth/signin");

  const test = await db.iELTSTest.findUnique({
    where: { id: params.testId },
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!test || test.studentId !== student.id) {
    redirect("/learning/writing");
  }

  const assessment = test.aiAnalysis as any;
  const answers = test.answers as any;

  const getBandColor = (band: number) => {
    if (band >= 8) return "text-green-400";
    if (band >= 7) return "text-blue-400";
    if (band >= 6) return "text-yellow-400";
    return "text-orange-400";
  };

  const getBandLabel = (band: number) => {
    if (band >= 8.5) return "Excellent";
    if (band >= 7.5) return "Very Good";
    if (band >= 6.5) return "Good";
    if (band >= 5.5) return "Competent";
    return "Keep Practicing";
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link href="/learning/writing" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Writing
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">AI Assessment Results</h1>
          <p className="text-gray-400">Detailed feedback on your writing</p>
        </div>

        {/* Overall Band Score */}
        <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">Overall Band Score</p>
              <div className={`text-7xl font-bold mb-2 ${getBandColor(assessment.overallBand)}`}>
                {assessment.overallBand.toFixed(1)}
              </div>
              <p className={`text-xl ${getBandColor(assessment.overallBand)}`}>
                {getBandLabel(assessment.overallBand)}
              </p>
              <div className="mt-6 max-w-md mx-auto">
                <Progress value={(assessment.overallBand / 9) * 100} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Criterion Scores */}
          <Card className="glass border-purple-500/30 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-purple-400">Criterion Scores</CardTitle>
              <CardDescription>Breakdown by IELTS assessment criteria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Achievement */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Task Achievement</span>
                  <span className={`text-xl font-bold ${getBandColor(assessment.taskAchievement)}`}>
                    {assessment.taskAchievement.toFixed(1)}
                  </span>
                </div>
                <Progress value={(assessment.taskAchievement / 9) * 100} className="h-2" />
                <p className="text-xs text-gray-400 mt-1">
                  How well you addressed the task requirements
                </p>
              </div>

              {/* Coherence & Cohesion */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Coherence & Cohesion</span>
                  <span className={`text-xl font-bold ${getBandColor(assessment.coherenceCohesion)}`}>
                    {assessment.coherenceCohesion.toFixed(1)}
                  </span>
                </div>
                <Progress value={(assessment.coherenceCohesion / 9) * 100} className="h-2" />
                <p className="text-xs text-gray-400 mt-1">
                  Organization, flow, and logical connections
                </p>
              </div>

              {/* Lexical Resource */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Lexical Resource</span>
                  <span className={`text-xl font-bold ${getBandColor(assessment.lexicalResource)}`}>
                    {assessment.lexicalResource.toFixed(1)}
                  </span>
                </div>
                <Progress value={(assessment.lexicalResource / 9) * 100} className="h-2" />
                <p className="text-xs text-gray-400 mt-1">
                  Vocabulary range and accuracy
                </p>
              </div>

              {/* Grammar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Grammatical Range & Accuracy</span>
                  <span className={`text-xl font-bold ${getBandColor(assessment.grammarAccuracy)}`}>
                    {assessment.grammarAccuracy.toFixed(1)}
                  </span>
                </div>
                <Progress value={(assessment.grammarAccuracy / 9) * 100} className="h-2" />
                <p className="text-xs text-gray-400 mt-1">
                  Grammar structures and accuracy
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Detection */}
          <Card className="glass border-averna-primary/30 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-averna-neon">AI Detection Analysis</CardTitle>
              <CardDescription>Originality assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">AI-Generated Content Score</p>
                <div className="text-5xl font-bold mb-2">
                  <span className={assessment.aiDetectionScore > 50 ? "text-red-400" : "text-green-400"}>
                    {assessment.aiDetectionScore}%
                  </span>
                </div>
                <Progress value={assessment.aiDetectionScore} className="h-2 mt-4" />
              </div>

              {assessment.aiDetectionScore <= 30 ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-semibold mb-1">Appears Original</p>
                  <p className="text-xs text-gray-400">
                    Your writing shows strong human characteristics
                  </p>
                </div>
              ) : assessment.aiDetectionScore <= 60 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                  <AlertCircle className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-yellow-400 font-semibold mb-1">Moderate AI Similarity</p>
                  <p className="text-xs text-gray-400">
                    Some patterns suggest AI assistance
                  </p>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-red-400 font-semibold mb-1">High AI Similarity</p>
                  <p className="text-xs text-gray-400">
                    Writing shows strong AI characteristics
                  </p>
                </div>
              )}

              <div className="mt-6 p-4 bg-averna-primary/10 rounded-lg">
                <p className="text-xs text-gray-400 text-center">
                  💡 Note: This is an estimate. Write naturally to improve authenticity.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strengths */}
        <Card className="glass border-green-500/30 mt-6 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400">
              <TrendingUp className="h-5 w-5" />
              Strengths
            </CardTitle>
            <CardDescription>What you did well</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.strengths.map((strength: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="glass border-orange-500/30 mt-6 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <TrendingDown className="h-5 w-5" />
              Areas for Improvement
            </CardTitle>
            <CardDescription>What to work on</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.weaknesses.map((weakness: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-gray-300">
                  <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="glass border-blue-500/30 mt-6 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Trophy className="h-5 w-5" />
              Recommendations
            </CardTitle>
            <CardDescription>How to improve your score</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-gray-300">
                  <span className="text-blue-400 mt-0.5 flex-shrink-0">📚</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Detailed Feedback */}
        <Card className="glass border-averna-primary/30 mt-6 animate-fade-in">
          <CardHeader>
            <CardTitle>Detailed Feedback</CardTitle>
            <CardDescription>In-depth analysis of your writing</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line break-words">
              {assessment.detailedFeedback}
            </p>
          </CardContent>
        </Card>

        {/* Error Analysis (#4) */}
        {Array.isArray(assessment.issues) && assessment.issues.length > 0 && (
          <Card className="glass border-averna-pink/30 mt-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-averna-pink">
                <AlertCircle className="h-5 w-5" />
                Error Analysis
              </CardTitle>
              <CardDescription>Specific issues detected in your text</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assessment.issues.map((issue: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-averna-pink/20 text-averna-pink border border-averna-pink/30 shrink-0 mt-0.5">
                      {issue.type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        <span className="text-red-300">&ldquo;{issue.text}&rdquo;</span>
                      </p>
                      <p className="text-xs text-gray-400">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* What's next */}
        <NextStepCard studentId={student.id} completedLabel="Writing" completedScore={assessment.overallBand} />

        {/* Actions */}
        <div className="flex gap-4 mt-8 animate-fade-in">
          <Link href="/learning/writing" className="flex-1">
            <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
              <RotateCcw className="mr-2 h-4 w-4" />
              Practice Again
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
