export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountNotice } from "@/components/account-notice";
import { SubmitForm, ReviewForm } from "@/components/peer/peer-forms";
import { Users, ArrowLeft, Star, MessageSquare, Inbox, Send } from "lucide-react";

interface PeerSubmissionRow {
  id: string;
  studentId: string;
  authorName: string;
  title: string;
  taskType: string;
  content: string;
  createdAt: Date;
}
interface PeerReviewRow {
  id: string;
  submissionId: string;
  reviewerName: string;
  rating: number;
  strengths: string;
  improvements: string;
  createdAt: Date;
}

export default async function PeerReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to use Peer Review." />;
  }

  let setupNeeded = false;
  let openSubs: PeerSubmissionRow[] = [];
  let mySubs: PeerSubmissionRow[] = [];
  let reviewsBySubmission: Record<string, PeerReviewRow[]> = {};
  let reviewedSet = new Set<string>();
  let reviewsGiven = 0;

  try {
    const anyDb = db as any;
    openSubs = await anyDb.peerSubmission.findMany({
      where: { studentId: { not: student.id } },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    mySubs = await anyDb.peerSubmission.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    });
    const myIds = mySubs.map((s) => s.id);
    if (myIds.length) {
      const reviews: PeerReviewRow[] = await anyDb.peerReview.findMany({
        where: { submissionId: { in: myIds } },
        orderBy: { createdAt: "desc" },
      });
      for (const r of reviews) (reviewsBySubmission[r.submissionId] ??= []).push(r);
    }
    const mine: { submissionId: string }[] = await anyDb.peerReview.findMany({
      where: { reviewerId: student.id },
      select: { submissionId: true },
    });
    reviewedSet = new Set(mine.map((m) => m.submissionId));
    reviewsGiven = mine.length;
  } catch {
    setupNeeded = true;
  }

  const toReview = openSubs.filter((s) => !reviewedSet.has(s.id));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        <DashboardHeader user={student.user} />

        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="h-8 w-8 text-averna-pink" />
          Peer <span className="neon-text-purple">Review</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Submit your writing for classmates to review, and earn{" "}
          <span className="text-averna-neon">+10 XP</span> for every helpful review you give. 🤝
        </p>

        {setupNeeded ? (
          <Card className="glass border-yellow-500/40">
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-2xl">🛠️</p>
              <p className="text-yellow-300 font-semibold">Peer Review is almost ready</p>
              <p className="text-gray-400 text-sm">
                The feature is deployed but its database tables need to be created. An admin can activate it by
                running <code className="text-averna-cyan">npx prisma db push</code> once.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {reviewsGiven > 0 && (
              <p className="text-sm text-averna-neon">⭐ You&apos;ve given {reviewsGiven} review{reviewsGiven > 1 ? "s" : ""} — thank you for helping the community!</p>
            )}

            {/* Submit */}
            <Card className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-5 w-5 text-averna-cyan" /> Submit your writing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SubmitForm />
              </CardContent>
            </Card>

            {/* Review others */}
            <Card className="glass border-averna-pink/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-averna-pink">
                  <Star className="h-5 w-5" /> Review a peer ({toReview.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {toReview.length === 0 ? (
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Inbox className="h-4 w-4" /> Nothing to review right now. Check back soon!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {toReview.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-white truncate">{s.title}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple shrink-0">
                            {s.taskType}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">by {s.authorName}</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-6">{s.content}</p>
                        <ReviewForm submissionId={s.id} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My submissions + feedback received */}
            <Card className="glass border-averna-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-averna-neon" /> My submissions & feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mySubs.length === 0 ? (
                  <p className="text-sm text-gray-400">You haven&apos;t submitted anything yet.</p>
                ) : (
                  <div className="space-y-3">
                    {mySubs.map((s) => {
                      const revs = reviewsBySubmission[s.id] ?? [];
                      const avg = revs.length
                        ? (revs.reduce((a, b) => a + b.rating, 0) / revs.length).toFixed(1)
                        : null;
                      return (
                        <div key={s.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-white truncate">{s.title}</p>
                            <span className="text-xs text-gray-400 shrink-0">
                              {revs.length} review{revs.length !== 1 ? "s" : ""}
                              {avg && <span className="text-averna-cyan font-semibold"> · avg {avg}</span>}
                            </span>
                          </div>
                          {revs.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {revs.map((r) => (
                                <div key={r.id} className="text-sm bg-white/5 rounded-md p-2 border border-white/5">
                                  <p className="text-xs text-averna-cyan font-semibold mb-1">
                                    {r.reviewerName} · band {r.rating}
                                  </p>
                                  {r.strengths && (
                                    <p className="text-gray-300">
                                      <span className="text-averna-neon">+ </span>
                                      {r.strengths}
                                    </p>
                                  )}
                                  {r.improvements && (
                                    <p className="text-gray-300">
                                      <span className="text-orange-300">→ </span>
                                      {r.improvements}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
