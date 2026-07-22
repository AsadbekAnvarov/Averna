export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Sparkles, Lock } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { getLevelInfo } from "@/lib/utils";

async function redeemReward(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return;

  const rewardId = formData.get("rewardId") as string;
  const reward = await db.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.active) {
    redirect("/rewards?error=unavailable");
  }
  if (getLevelInfo(student.totalPoints).level < (reward.minLevel ?? 1)) {
    redirect("/rewards?error=level");
  }
  if (student.totalPoints < reward.cost) {
    redirect("/rewards?error=points");
  }

  await db.student.update({
    where: { id: student.id },
    data: { totalPoints: { decrement: reward.cost } },
  });
  await db.rewardRedemption.create({
    data: { studentId: student.id, rewardId: reward.id, cost: reward.cost, status: "PENDING" },
  });
  await db.activityLog.create({
    data: {
      studentId: student.id,
      action: "REWARD_REDEEMED",
      details: { reward: reward.name, cost: reward.cost },
      points: -reward.cost,
    },
  }).catch(() => {});

  revalidatePath("/rewards");
  redirect("/rewards?success=1");
}

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      redemptions: { include: { reward: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to use the rewards store." />;
  }

  const rewards = await db.reward.findMany({
    where: { active: true },
    orderBy: { cost: "asc" },
  });

  const studentLevel = getLevelInfo(student.totalPoints).level;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Gift}
          iconClassName="text-averna-pink"
          title={<>Rewards <span className="neon-text-purple">Store</span></>}
          action={
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-averna-neon/15 border border-averna-neon/40 text-averna-neon font-bold">
              <Coins className="h-5 w-5" /> {student.totalPoints} points
            </span>
          }
        />

        {searchParams.success && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">
            🎉 Reward redeemed! Your request is pending approval.
          </div>
        )}
        {searchParams.error === "points" && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
            Not enough points for that reward yet — keep learning! 💪
          </div>
        )}
        {searchParams.error === "level" && (
          <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
            🔒 That reward is locked — reach the required level first. Keep climbing!
          </div>
        )}

        {/* Catalog */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {rewards.map((r) => {
            const minLevel = r.minLevel ?? 1;
            const levelLocked = studentLevel < minLevel;
            const affordable = student.totalPoints >= r.cost;
            const canRedeem = affordable && !levelLocked;
            return (
              <Card key={r.id} className={`glass relative ${canRedeem ? "border-averna-neon/30" : "border-white/10"} ${levelLocked ? "opacity-80" : ""}`}>
                {minLevel > 1 && (
                  <span
                    className={`absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                      levelLocked
                        ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                        : "text-averna-neon border-averna-neon/40 bg-averna-neon/10"
                    }`}
                  >
                    {levelLocked && <Lock className="h-3 w-3" />} Lvl {minLevel}+
                  </span>
                )}
                <CardContent className="py-6 text-center flex flex-col h-full">
                  <div className="text-4xl mb-2">{r.icon ?? "🎁"}</div>
                  <p className="text-white font-semibold">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-400 mt-1 flex-1">{r.description}</p>}
                  <p className="text-averna-cyan font-bold mt-3 mb-3 flex items-center justify-center gap-1">
                    <Coins className="h-4 w-4" /> {r.cost}
                  </p>
                  <form action={redeemReward}>
                    <input type="hidden" name="rewardId" value={r.id} />
                    <Button
                      type="submit"
                      disabled={!canRedeem}
                      className="w-full neon-button bg-averna-primary hover:bg-averna-light disabled:opacity-40"
                    >
                      {levelLocked
                        ? `Reach Level ${minLevel}`
                        : affordable
                        ? "Redeem"
                        : `Need ${r.cost - student.totalPoints} more`}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* My redemptions */}
        <Card className="glass border-averna-purple/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-purple">
              <Sparkles className="h-5 w-5" /> My Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.redemptions.length === 0 ? (
              <p className="text-sm text-gray-400">No redemptions yet.</p>
            ) : (
              <div className="space-y-2">
                {student.redemptions.map((red) => (
                  <div key={red.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white font-medium">{red.reward.icon} {red.reward.name}</p>
                      <p className="text-xs text-gray-500">{new Date(red.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent" })} · {red.cost} pts</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      red.status === "APPROVED" ? "text-averna-neon border-averna-neon/40 bg-averna-neon/10"
                      : red.status === "REJECTED" ? "text-red-300 border-red-500/40 bg-red-500/10"
                      : "text-yellow-300 border-yellow-500/40 bg-yellow-500/10"
                    }`}>
                      {red.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
