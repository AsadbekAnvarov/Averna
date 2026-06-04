export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, Layers, UserPlus, Inbox, BarChart3, Gift, Megaphone, Activity, Wallet, ScrollText } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { TopPerformers } from "@/components/top-performers";
import { recordAudit } from "@/lib/audit";

const LEVELS = [
  "Beginner (A2)",
  "Intermediate (B1)",
  "Upper-Intermediate (B2)",
  "Advanced (C1)",
  "IELTS Standard (6.0–6.5)",
  "IELTS Advanced (7.5+)",
];

async function enrollStudent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  const level = (formData.get("level") as string)?.trim();
  const groupId = (formData.get("groupId") as string)?.trim();

  await db.student.update({
    where: { id: studentId },
    data: {
      level: level || null,
      groupId: groupId || null,
      enrolledAt: new Date(),
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Enrolled student",
    `studentId=${studentId} level=${level || "-"} group=${groupId || "-"}`
  );
  revalidatePath("/admin/dashboard");
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  // Only ADMINs continue
  if (session.user.role !== "ADMIN") {
    return (
      <AccountNotice
        title="Admins only"
        message="This area is reserved for administrators."
      />
    );
  }

  const [students, groups, teacherCount] = await Promise.all([
    db.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.group.findMany({
      include: { teacher: { include: { user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
    db.teacher.count(),
  ]);

  const pending = students.filter((s) => !s.groupId);

  const StudentForm = ({ s }: { s: (typeof students)[number] }) => (
    <form action={enrollStudent} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
      <input type="hidden" name="studentId" value={s.id} />
      <div className="md:w-56 min-w-0">
        <p className="text-white font-medium truncate">{s.user.name ?? "Unnamed"}</p>
        <p className="text-xs text-gray-400 truncate">{s.user.email}</p>
      </div>
      <select
        name="level"
        defaultValue={s.level ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Level —</option>
        {LEVELS.map((l) => (
          <option key={l} value={l} className="bg-averna-dark">{l}</option>
        ))}
      </select>
      <select
        name="groupId"
        defaultValue={s.groupId ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Unassigned —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id} className="bg-averna-dark">
            {g.name} · {g.teacher.user.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
        Save
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />

        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <ShieldGraphic />
          Admin Panel
        </h1>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/admin/analytics">
            <Button className="neon-button bg-averna-cyan/80 hover:bg-averna-cyan text-black">
              <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            </Button>
          </Link>
          <Link href="/admin/groups">
            <Button className="neon-button bg-averna-purple/80 hover:bg-averna-purple">
              <Layers className="mr-2 h-4 w-4" /> Manage Groups
            </Button>
          </Link>
          <Link href="/admin/teachers">
            <Button className="neon-button bg-blue-500/80 hover:bg-blue-500">
              <GraduationCap className="mr-2 h-4 w-4" /> Manage Teachers
            </Button>
          </Link>
          <Link href="/admin/rewards">
            <Button className="neon-button bg-averna-pink/80 hover:bg-averna-pink">
              <Gift className="mr-2 h-4 w-4" /> Rewards &amp; Requests
            </Button>
          </Link>
          <Link href="/admin/announcements">
            <Button variant="outline" className="border-averna-neon/40 text-averna-neon">
              <Megaphone className="mr-2 h-4 w-4" /> Announce
            </Button>
          </Link>
          <Link href="/admin/content">
            <Button variant="outline" className="border-averna-purple/40 text-averna-purple">
              <Layers className="mr-2 h-4 w-4" /> Manage Content
            </Button>
          </Link>
          <Link href="/admin/finance">
            <Button variant="outline" className="border-averna-neon/40 text-averna-neon">
              <Wallet className="mr-2 h-4 w-4" /> Finance
            </Button>
          </Link>
          <Link href="/admin/system">
            <Button variant="outline" className="border-averna-cyan/40 text-averna-cyan">
              <Activity className="mr-2 h-4 w-4" /> System Health
            </Button>
          </Link>
          <Link href="/admin/logs">
            <Button variant="outline" className="border-white/20 text-gray-200">
              <ScrollText className="mr-2 h-4 w-4" /> Audit Log
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatCard icon={<Users className="h-4 w-4" />} label="Students" value={students.length} color="cyan" />
          <StatCard icon={<GraduationCap className="h-4 w-4" />} label="Teachers" value={teacherCount} color="purple" />
          <StatCard icon={<Layers className="h-4 w-4" />} label="Groups" value={groups.length} color="neon" />
          <StatCard icon={<Inbox className="h-4 w-4" />} label="Pending" value={pending.length} color="pink" />
        </div>

        {/* Pending enrollment */}
        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-pink">
              <UserPlus className="h-5 w-5" />
              Enroll New Students ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Set each new student&apos;s level and assign them to a group (and its teacher).
            </p>
            {pending.length === 0 ? (
              <p className="text-gray-400 text-sm">🎉 No students waiting for enrollment.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((s) => (
                  <StudentForm key={s.id} s={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All students */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan">
              <Users className="h-5 w-5" />
              All Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-gray-400 text-sm">No students yet.</p>
            ) : (
              <div className="space-y-2">
                {students.map((s) => (
                  <StudentForm key={s.id} s={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hall of Fame */}
        <h2 className="text-2xl font-bold text-white mb-4">🏆 Hall of Fame</h2>
        <TopPerformers />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "cyan" | "purple" | "neon" | "pink";
}) {
  const map = {
    cyan: "border-averna-cyan/30 text-averna-cyan",
    purple: "border-averna-purple/30 text-averna-purple",
    neon: "border-averna-neon/30 text-averna-neon",
    pink: "border-averna-pink/30 text-averna-pink",
  } as const;
  return (
    <Card className={`glass ${map[color].split(" ")[0]}`}>
      <CardHeader>
        <CardTitle className={`text-sm flex items-center gap-2 ${map[color].split(" ")[1]}`}>
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${map[color].split(" ")[1]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ShieldGraphic() {
  return <span className="text-averna-purple">🛡️</span>;
}
