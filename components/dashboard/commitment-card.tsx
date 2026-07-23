import { revalidatePath } from "next/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Coins, Gift, CalendarClock, CheckCircle2, XCircle, Flame } from "lucide-react";
import { db } from "@/lib/db";
import {
  getActiveCommitment,
  commitmentProgress,
  resolveDueCommitments,
  getLastResolved,
  createCommitment,
  bonusFor,
  STAKE_OPTIONS,
  DAYS_OPTIONS,
} from "@/lib/commitments";

/**
 * "Streak Insurance" — the student stakes points on a weekly study goal.
 * Hit it → stake back + a 50% bonus. Miss it → the stake is lost (loss aversion
 * is a powerful commitment device). Fully server-rendered; resolves due
 * challenges lazily on each dashboard load.
 */
export async function CommitmentCard({ studentId }: { studentId: string }) {
  // Settle any finished challenges first (awards/keeps points).
  await resolveDueCommitments(studentId);

  const [active, last, student] = await Promise.all([
    getActiveCommitment(studentId),
    getLastResolved(studentId),
    db.student.findUnique({ where: { id: studentId }, select: { totalPoints: true } }),
  ]);

  const balance = student?.totalPoints ?? 0;
  const progress = active ? await commitmentProgress(active) : 0;

  async function startChallenge(formData: FormData) {
    "use server";
    const targetDays = parseInt(formData.get("targetDays") as string, 10);
    const stake = parseInt(formData.get("stake") as string, 10);
    await createCommitment(studentId, targetDays, stake);
    revalidatePath("/dashboard");
  }

  // Recently resolved (within ~2 days) → show a small result note.
  const recentlyResolved =
    last && last.status !== "active" && Date.now() - new Date(last.endAt).getTime() < 2 * 86400000
      ? last
      : null;

  return (
    <Card className="glass border-averna-primary/30 h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ShieldCheck className="h-5 w-5 text-averna-neon" /> Study Challenge
        </CardTitle>
      </CardHeader>
      <CardContent>
        {active ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-300">
                Study on <span className="font-bold text-white">{active.targetDays} days</span> this week
              </p>
              <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-averna-neon to-averna-cyan transition-all"
                  style={{ width: `${Math.min(100, Math.round((progress / active.targetDays) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {progress} / {active.targetDays} study days ·{" "}
                {Math.max(0, Math.ceil((new Date(active.endAt).getTime() - Date.now()) / 86400000))} days left
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300">
                <Coins className="h-3.5 w-3.5" /> {active.stake} staked
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">
                <Gift className="h-3.5 w-3.5" /> +{active.stake + active.reward} on success
              </span>
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> Keep studying — a study day counts once you earn any points that day.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentlyResolved && (
              <div
                className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
                  recentlyResolved.status === "succeeded"
                    ? "bg-averna-neon/10 border-averna-neon/30 text-averna-neon"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {recentlyResolved.status === "succeeded" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Last challenge won! +{recentlyResolved.stake + recentlyResolved.reward} pts 🎉
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Last challenge missed — {recentlyResolved.stake} pts lost. Try again!
                  </>
                )}
              </div>
            )}

            <p className="text-sm text-gray-300">
              Stake points on a study goal. Hit it and win your stake back <span className="text-averna-neon font-medium">+50% bonus</span>; miss it and you lose the stake. 🔥
            </p>

            {balance < STAKE_OPTIONS[0] ? (
              <p className="text-xs text-gray-500">Earn at least {STAKE_OPTIONS[0]} points to start a challenge.</p>
            ) : (
              <form action={startChallenge} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400">Study days / week</label>
                    <select name="targetDays" defaultValue={5} className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white">
                      {DAYS_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400">Stake (points)</label>
                    <select name="stake" defaultValue={STAKE_OPTIONS[0]} className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm text-white">
                      {STAKE_OPTIONS.filter((s) => s <= balance).map((s) => (
                        <option key={s} value={s}>{s} → win {s + bonusFor(s)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Start the challenge
                </Button>
                <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3" /> Runs for 7 days · your balance: {balance} pts
                </p>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
