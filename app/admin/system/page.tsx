export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Bot, Users, GraduationCap, Layers, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function AdminSystemPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  let dbOk = true;
  let counts = { students: 0, teachers: 0, groups: 0, tests: 0, messages: 0 };
  try {
    const [students, teachers, groups, tests, messages] = await Promise.all([
      db.student.count(),
      db.teacher.count(),
      db.group.count(),
      db.iELTSTest.count(),
      db.message.count(),
    ]);
    counts = { students, teachers, groups, tests, messages };
  } catch {
    dbOk = false;
  }

  const aiOn = hasOpenAI();

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
      <span className="text-white text-sm">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm ${ok ? "text-averna-neon" : "text-yellow-400"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {detail}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Admin Panel</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Activity className="h-8 w-8 text-averna-neon" /> System <span className="neon-text">Health</span>
        </h1>
        <p className="text-gray-400 mb-6">Status of core services and platform data.</p>

        <Card className="glass border-averna-neon/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-neon"><Database className="h-5 w-5" /> Services</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row ok={dbOk} label="Database (Neon PostgreSQL)" detail={dbOk ? "Connected" : "Error"} />
            <Row ok={aiOn} label="AI features (OpenAI)" detail={aiOn ? "GPT-4 active" : "Offline mode (heuristics)"} />
          </CardContent>
        </Card>

        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Activity className="h-5 w-5" /> Platform Data</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat icon={<Users className="h-4 w-4" />} label="Students" value={counts.students} />
              <Stat icon={<GraduationCap className="h-4 w-4" />} label="Teachers" value={counts.teachers} />
              <Stat icon={<Layers className="h-4 w-4" />} label="Groups" value={counts.groups} />
              <Stat icon={<Bot className="h-4 w-4" />} label="Tests taken" value={counts.tests} />
              <Stat icon={<Activity className="h-4 w-4" />} label="Messages" value={counts.messages} />
            </div>
            {!aiOn && (
              <p className="text-xs text-gray-500 mt-4">
                Tip: add <code className="text-averna-cyan">OPENAI_API_KEY</code> in Vercel to enable full AI feedback. Everything works without it via smart heuristics.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">{icon}{label}</div>
      <p className="text-2xl font-bold text-averna-cyan">{value}</p>
    </div>
  );
}
