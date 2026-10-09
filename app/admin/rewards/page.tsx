export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardXp } from "@/lib/engine/xp-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Plus, Check, X, Coins } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { notifyUser } from "@/lib/notifications";
import { MAX_LEVEL } from "@/lib/engine/progression/levels";
import { setRewardAvailability, updateReward } from "@/lib/admin/reward-actions";
import { ConfirmedAction } from "@/components/admin/confirmed-action";
import { formatDate } from "@/lib/utils";

async function addReward(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const name = (formData.get("name") as string)?.trim();
  const cost = Number(formData.get("cost"));
  const description = (formData.get("description") as string)?.trim();
  const icon = (formData.get("icon") as string)?.trim() || "🎁";
  const minLevel = Number(formData.get("minLevel") ?? 1);
  if (!name || name.length > 200 || !Number.isSafeInteger(cost) || cost < 1 || cost > 2147483647 || !Number.isInteger(minLevel) || minLevel < 1 || minLevel > MAX_LEVEL) return;
  await db.reward.create({ data: { name, cost, description: description || null, icon, minLevel } });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
}

async function moderate(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const action = formData.get("action") as string;
  if (action !== "approve" && action !== "reject") return;

  const red = await db.rewardRedemption.findUnique({
    where: { id },
    include: { reward: true, student: { select: { id: true, userId: true } } },
  });
  if (!red || red.status !== "PENDING") return;

  if (action === "approve") {
    await db.rewardRedemption.update({ where: { id }, data: { status: "APPROVED" } });
    await notifyUser(red.student.userId, {
      type: "system",
      title: "🎁 Reward approved!",
      message: `Your "${red.reward.name}" is approved. Collect it from the centre.`,
      link: "/rewards",
    });
  } else {
    // Refund the points on rejection
    await db.rewardRedemption.update({ where: { id }, data: { status: "REJECTED" } });
    await awardXp({
      studentId: red.student.id,
      amount: red.cost,
      source: "reward_refund",
      details: { cost: red.cost, reason: "redemption rejected" },
    });
    await notifyUser(red.student.userId, {
      type: "system",
      title: "Reward request declined",
      message: `Your "${red.reward.name}" request was declined and ${red.cost} points were refunded.`,
      link: "/rewards",
    });
  }
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
}

export default async function AdminRewardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const [pending, rewards] = await Promise.all([
    db.rewardRedemption.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { reward: true, student: { include: { user: { select: { name: true } } } } },
    }),
    db.reward.findMany({ orderBy: { cost: "asc" } }),
  ]);

  const activeRewards = rewards.filter(r => r.active);
  const removedRewards = rewards.filter(r => !r.active);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Gift}
          iconClassName="text-averna-pink"
          title={<>Mukofotlar va <span className="neon-text-purple">soʻrovlar</span></>}
          subtitle="Oʻquvchilar soʻrovlarini tasdiqlang va mukofotlar katalogini boshqaring."
        />

        {/* Pending requests */}
        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-pink">Kutilayotgan soʻrovlar ({pending.length})</CardTitle></CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-gray-400 text-sm">🎉 Kutilayotgan soʻrovlar yoʻq.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="min-w-0">
                      <p className="text-white font-medium">{r.reward.icon} {r.reward.name}</p>
                      <p className="text-xs text-gray-400">{r.student.user.name} · {r.cost} ball · {formatDate(r.createdAt)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={moderate}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="action" value="approve" />
                        <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light"><Check className="h-4 w-4" /></Button>
                      </form>
                      <form action={moderate}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="action" value="reject" />
                        <Button type="submit" size="sm" variant="outline" className="border-red-500/50 text-red-300"><X className="h-4 w-4" /></Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add reward */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Plus className="h-5 w-5" /> Mukofot qoʻshish</CardTitle></CardHeader>
          <CardContent>
            <form action={addReward} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nomi</Label>
                <Input id="name" name="name" placeholder="masalan, Bepul sinov darsi" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Narxi (ball)</Label>
                <Input id="cost" name="cost" type="number" min="1" placeholder="300" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Belgi (emoji)</Label>
                <Input id="icon" name="icon" placeholder="🎁" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minLevel">Min. daraja (cheklov)</Label>
                <Input id="minLevel" name="minLevel" type="number" min="1" max={MAX_LEVEL} defaultValue="1" placeholder="1" className="bg-background/50" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Tavsif</Label>
                <Input id="description" name="description" placeholder="Qisqa tavsif" className="bg-background/50" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Doʻkonga qoʻshish</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Catalog: equal-height cards; removal retains redemption history. */}
        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="text-white">Katalog ({activeRewards.length})</CardTitle><p className="text-sm text-gray-400">Oʻchirish mukofotni doʻkondan olib tashlaydi. Oldingi soʻrovlar va ball tarixi saqlanadi.</p></CardHeader>
          <CardContent>
            {activeRewards.length === 0 && <p className="text-sm text-gray-400 py-4">Doʻkonda mukofotlar yoʻq. Yuqoridan yangi mukofot qoʻshing.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {activeRewards.map(r => (
                <article key={r.id} className="flex min-w-0 flex-col gap-4 rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-white font-medium break-words min-w-0">{r.icon} {r.name}</h2>
                    <span className="text-averna-cyan font-semibold inline-flex items-center gap-1 shrink-0"><Coins className="h-4 w-4" aria-hidden />{r.cost}</span>
                  </div>
                  {r.description && <p className="text-sm text-gray-400 break-words">{r.description}</p>}
                  <p className="text-xs text-amber-300">Lvl {r.minLevel}+</p>
                  <div className="mt-auto flex flex-wrap gap-2 items-start">
                    <details className="min-w-0 w-full">
                      <summary className="cursor-pointer min-h-11 flex items-center text-sm text-averna-cyan focus-visible:outline focus-visible:outline-2">Tahrirlash</summary>
                      <form action={updateReward} className="grid gap-3 pb-4">
                        <input type="hidden" name="id" value={r.id} />
                        <label className="text-sm text-gray-400">Nomi<Input name="name" defaultValue={r.name} maxLength={200} required /></label>
                        <label className="text-sm text-gray-400">Narxi (ball)<Input name="cost" type="number" min={1} max={2147483647} defaultValue={r.cost} required /></label>
                        <label className="text-sm text-gray-400">Min. daraja<Input name="minLevel" type="number" min={1} max={MAX_LEVEL} defaultValue={r.minLevel} required /></label>
                        <label className="text-sm text-gray-400">Belgi (emoji)<Input name="icon" defaultValue={r.icon ?? "🎁"} /></label>
                        <label className="text-sm text-gray-400">Tavsif<Input name="description" defaultValue={r.description ?? ""} /></label>
                        <Button type="submit" className="min-h-11">Saqlash</Button>
                      </form>
                    </details>
                    <ConfirmedAction action={setRewardAvailability} fields={{ id: r.id, action: "remove" }} title={`“${r.name}” oʻchirilsinmi?`} description="Mukofot oʻquvchilar doʻkonidan olib tashlanadi. Oldingi soʻrovlar saqlanadi va ularni odatdagidek tasdiqlash yoki rad etish mumkin. Mukofotni keyin tiklashingiz mumkin." />
                  </div>
                </article>
              ))}
            </div>
            {removedRewards.length > 0 && <details className="mt-6 border-t border-white/10 pt-4">
              <summary className="cursor-pointer min-h-11 text-sm text-gray-400">Oʻchirilgan mukofotlar ({removedRewards.length})</summary>
              <div className="mt-3 space-y-3">{removedRewards.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="min-w-0 text-sm text-gray-400 break-words">{r.icon} {r.name} · {r.cost} ball</span><ConfirmedAction action={setRewardAvailability} fields={{ id: r.id, action: "restore" }} label="Tiklash" destructive={false} title="Mukofot tiklansinmi?" description="Mukofot yana oʻquvchilar doʻkonida koʻrinadi." /></div>)}</div>
            </details>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
