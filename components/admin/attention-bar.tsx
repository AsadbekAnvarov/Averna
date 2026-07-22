import Link from "next/link";
import { db } from "@/lib/db";
import { UserPlus, Wallet, Gift, Scale, CheckCircle2 } from "lucide-react";

/**
 * Admin focus bar — the few things across the whole platform that need a
 * decision right now: students awaiting placement, pending payments, reward
 * requests to approve, and overloaded teachers. Each chip deep-links to action.
 */
export async function AdminAttentionBar() {
  const [unplaced, pendingPayments, pendingRewards, teachers] = await Promise.all([
    db.student.count({ where: { groupId: null } }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.rewardRedemption.count({ where: { status: "PENDING" } }),
    db.teacher.findMany({ include: { groups: { include: { students: { select: { id: true } } } } } }),
  ]);

  // Overloaded teachers: carrying > 1.5x the average student count
  const loads = teachers.map((t) => t.groups.reduce((s, g) => s + g.students.length, 0));
  const avg = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const overloaded = avg > 0 ? loads.filter((l) => l > avg * 1.5).length : 0;

  const chips = [
    unplaced > 0 && {
      href: "/admin/dashboard#enroll",
      icon: UserPlus,
      label: `${unplaced} ta joylashtirish kerak`,
      cls: "border-averna-pink/30 bg-averna-pink/10 text-averna-pink hover:border-averna-pink/60",
    },
    pendingPayments > 0 && {
      href: "/admin/finance",
      icon: Wallet,
      label: `${pendingPayments} ta toʻlov kutilmoqda`,
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:border-amber-400/60",
    },
    pendingRewards > 0 && {
      href: "/admin/rewards",
      icon: Gift,
      label: `${pendingRewards} ta mukofot soʻrovi`,
      cls: "border-averna-purple/30 bg-averna-purple/10 text-averna-purple hover:border-averna-purple/60",
    },
    overloaded > 0 && {
      href: "/admin/teachers",
      icon: Scale,
      label: `${overloaded} ta oʻqituvchi ortiqcha yuklangan`,
      cls: "border-red-400/30 bg-red-400/10 text-red-300 hover:border-red-400/60",
    },
  ].filter(Boolean) as { href: string; icon: any; label: string; cls: string }[];

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-8">
      <span className="text-sm text-gray-400 font-medium">Eʼtibor talab qiladi:</span>
      {chips.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/10 text-averna-neon text-sm">
          <CheckCircle2 className="h-4 w-4" /> Hammasi joyida
        </span>
      ) : (
        chips.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${c.cls}`}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </Link>
          );
        })
      )}
    </div>
  );
}
