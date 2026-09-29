export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown, AlertCircle, CheckCircle, ArrowLeft, RotateCcw, Highlighter, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SessionOutcomeSection } from "@/components/progression/session-outcome-section";
import { ProgressionSkeleton } from "@/components/progression/progression-skeleton";
import { ResultCelebration } from "@/components/learning/result-celebration";
import { WritingHeatmap } from "@/components/learning/writing-heatmap";
import { TeacherReviewCard } from "@/components/review/teacher-review-card";
import { HomeworkNoticeCard } from "@/components/homework/homework-notice";
import { canViewStudent } from "@/lib/access";
import { homeworkNoticeFor } from "@/lib/homework/exam-homework";

export default async function WritingResultPage({
  params,
}: {
  params: { testId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const test = await db.iELTSTest.findUnique({
    where: { id: params.testId },
    include: {
      student: {
        include: {
          user: true,
        },
      },
      review: { select: { band: true } },
    },
  });

  if (!test) redirect("/learning/writing");
  // The student, a teacher of their group, or an admin.
  const viewerIsOwner = test.student.userId === session.user.id;
  if (!viewerIsOwner && !(await canViewStudent(session.user, test.studentId))) {
    redirect("/learning/writing");
  }
  const student = test.student;
  // Open homework for this prompt (or prompt pair) that this attempt didn't complete (owner only).
  const homeworkNotice = viewerIsOwner ? await homeworkNoticeFor(student.id, test) : null;

  const assessment = test.aiAnalysis as any;
  const answers = test.answers as any;
  // After a teacher's review their band is the attempt's band (IELTSTest.score);
  // the criterion scores below stay the AI examiner's.
  const teacherBand: number | null = typeof test.review?.band === "number" ? test.review.band : null;
  const shownBand: number = teacherBand ?? assessment.overallBand;
  const studentName: string = student.user?.name?.trim() || "Student";

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

  const targetNum = student.targetBand ? parseFloat(String(student.targetBand).replace(/[^0-9.]/g, "")) : NaN;
  const target = Number.isFinite(targetNum) ? targetNum : null;

  return (
    <div className="min-h-screen premium-gradient">
      {viewerIsOwner && <ResultCelebration score={shownBand} target={target} />}
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href={viewerIsOwner ? "/learning/writing" : "/teacher/reviews"}
            className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {viewerIsOwner ? "Back to Writing" : "Review queue"}
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            {viewerIsOwner ? "AI Assessment Results" : `${studentName} — Writing`}
          </h1>
          <p className="text-gray-400">
            {viewerIsOwner ? "Detailed feedback on your writing" : "The AI examiner's assessment of this attempt"}
          </p>
        </div>

        {homeworkNotice && <HomeworkNoticeCard notice={homeworkNotice} className="mb-8" />}

        {/* Overall Band Score */}
        <Card className="glass border-averna-primary/30 mb-8 animate-fade-in">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2 inline-flex items-center justify-center gap-1.5">
                {teacherBand !== null && <BadgeCheck className="h-4 w-4 text-averna-neon" aria-hidden />}
                {teacherBand !== null ? "Teacher's band" : "Overall Band Score"}
              </p>
              <div className={`text-7xl font-bold mb-2 block animate-pop ${getBandColor(shownBand)}`}>
                {shownBand.toFixed(1)}
              </div>
              <p className={`text-xl ${getBandColor(shownBand)}`}>
                {getBandLabel(shownBand)}
              </p>
              {teacherBand !== null && typeof assessment.overallBand === "number" && (
                <p className="mt-2 text-sm text-gray-400">
                  AI examiner&apos;s estimate: {assessment.overallBand.toFixed(1)} — the criterion scores below are the AI&apos;s.
                </p>
              )}
              <div className="mt-6 max-w-md mx-auto">
                <Progress value={(shownBand / 9) * 100} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* One more thing: what improved, what you earned, what's next */}
        <div className="mb-8">
          {viewerIsOwner && (
            <Suspense fallback={<ProgressionSkeleton rows={1} label="Calculating your progress…" />}>
            <SessionOutcomeSection studentId={student.id} testId={test.id} label="Writing" score={shownBand} />
          </Suspense>
          )}
          <TeacherReviewCard testId={test.id} viewerIsOwner={viewerIsOwner} />
        </div>

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

        {/* Writing Heatmap — essay with issues highlighted inline */}
        {answers?.essay && Array.isArray(assessment.issues) && assessment.issues.length > 0 && (
          <Card className="glass border-averna-cyan/30 mt-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-averna-cyan">
                <Highlighter className="h-5 w-5" />
                Writing Heatmap
              </CardTitle>
              <CardDescription>Your essay with issues highlighted — tap any highlight for a tip</CardDescription>
            </CardHeader>
            <CardContent>
              <WritingHeatmap essay={answers.essay} issues={assessment.issues} />
            </CardContent>
          </Card>
        )}

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


        {/* Actions */}
        {viewerIsOwner ? (
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
        ) : (
          <div className="flex gap-4 mt-8 animate-fade-in">
            <Link href="/teacher/reviews" className="flex-1">
              <Button variant="outline" className="w-full border-averna-neon text-averna-neon">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to the review queue
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
