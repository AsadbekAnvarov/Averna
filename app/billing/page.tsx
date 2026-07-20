export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, CreditCard, Receipt } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";

async function topUp(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return;

  const amount = Math.max(0, parseInt(formData.get("amount") as string) || 0);
  if (amount <= 0) return;

  await db.student.update({ where: { id: student.id }, data: { balance: { increment: amount } } });
  await db.payment.create({
    data: { studentId: student.id, amount, type: "TOPUP", description: "Balance top-up", status: "COMPLETED" },
  });
  revalidatePath("/billing");
  redirect("/billing?success=topup");
}

async function payCourse(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return;

  const amount = parseInt(formData.get("amount") as string) || 0;
  const description = (formData.get("description") as string) || "Course payment";
  if (amount <= 0) return;
  if (student.balance < amount) redirect("/billing?error=funds");

  await db.student.update({ where: { id: student.id }, data: { balance: { decrement: amount } } });
  await db.payment.create({
    data: { studentId: student.id, amount: -amount, type: "COURSE", description, status: "COMPLETED" },
  });
  revalidatePath("/billing");
  redirect("/billing?success=course");
}

const TOPUPS = [50000, 100000, 200000, 500000];
const PLANS = [
  { name: "Monthly Course", amount: 300000, desc: "1 month of group lessons" },
  { name: "3-Month Course", amount: 800000, desc: "Save 11% on 3 months" },
  { name: "1-on-1 Pack (5)", amount: 250000, desc: "Five private sessions" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to view billing." />;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Wallet}
          iconClassName="text-averna-neon"
          title={<span className="neon-text">Billing &amp; Balance</span>}
        />

        {searchParams.success && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">
            {searchParams.success === "topup" ? "✅ Balance topped up successfully!" : "✅ Payment completed — thank you!"}
          </div>
        )}
        {searchParams.error === "funds" && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
            Not enough balance. Please top up first.
          </div>
        )}

        {/* Balance */}
        <Card className="glass border-averna-neon/40 mb-6">
          <CardContent className="py-6 text-center">
            <p className="text-gray-400 text-sm">Current balance</p>
            <p className="text-4xl font-bold text-averna-neon mt-1">{fmt(student.balance)} <span className="text-lg text-gray-400">UZS</span></p>
          </CardContent>
        </Card>

        {/* Top up */}
        <Card className="glass border-averna-cyan/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Plus className="h-5 w-5" /> Top Up Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TOPUPS.map((a) => (
                <form action={topUp} key={a}>
                  <input type="hidden" name="amount" value={a} />
                  <Button type="submit" variant="outline" className="w-full border-averna-cyan/40 text-averna-cyan">
                    +{fmt(a)}
                  </Button>
                </form>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-3">Demo checkout — connect a real provider (Payme/Click/Stripe) later.</p>
          </CardContent>
        </Card>

        {/* Plans */}
        <Card className="glass border-averna-purple/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><CreditCard className="h-5 w-5" /> Pay for a Course</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {PLANS.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="min-w-0">
                  <p className="text-white font-medium">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.desc}</p>
                </div>
                <form action={payCourse} className="shrink-0">
                  <input type="hidden" name="amount" value={p.amount} />
                  <input type="hidden" name="description" value={p.name} />
                  <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light">
                    {fmt(p.amount)} UZS
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* History */}
        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Receipt className="h-5 w-5" /> Payment History</CardTitle></CardHeader>
          <CardContent>
            {student.payments.length === 0 ? (
              <p className="text-gray-400 text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {student.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white text-sm">{p.description ?? p.type}</p>
                      <p className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent" })} · {p.status}</p>
                    </div>
                    <span className={`font-semibold ${p.amount >= 0 ? "text-averna-neon" : "text-red-300"}`}>
                      {p.amount >= 0 ? "+" : ""}{fmt(p.amount)}
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
