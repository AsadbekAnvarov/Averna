export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Plus, Check, X, Coins } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { notifyUser } from "@/lib/notifications";
import { formatDate } from "@/lib/utils";

async function addReward(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const name = (formData.get("name") as string)?.trim();
  const cost = parseInt(formData.get("cost") as string) || 0;
  const description = (formData.get("description") as string)?.trim();
  const icon = (formData.get("icon") as string)?.trim() || "🎁";
  const minLevel = Math.max(1, parseInt(formData.get("minLevel") as string) || 1);
  if (!name || cost <= 0) return;
  await db.reward.create({ data: { name, cost, description: description || null, icon, minLevel } });
  revalidatePath("/admin/rewards");
}

async function moderate(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const action = formData.get("action") as string;

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
    await db.student.update({ where: { id: red.student.id }, data: { totalPoints: { increment: red.cost } } });
    await notifyUser(red.student.userId, {
      type: "system",
      title: "Reward request declined",
      message: `Your "${red.reward.name}" request was declined and ${red.cost} points were refunded.`,
      link: "/rewards",
    });
  }
  revalidatePath("/admin/rewards");
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
            <form action={addReward} className="grid sm:grid-cols-2 gap-4">
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
                <Input id="minLevel" name="minLevel" type="number" min="1" max="15" defaultValue="1" placeholder="1" className="bg-background/50" />
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

        {/* Catalog */}
        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="text-white">Katalog ({rewards.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white text-sm">
                    {r.icon} {r.name}
                    {(r.minLevel ?? 1) > 1 && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">Lvl {r.minLevel}+</span>
                    )}
                  </span>
                  <span className="text-averna-cyan font-semibold flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {r.cost}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
