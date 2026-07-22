export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Bot, Users, GraduationCap, Layers, CheckCircle2, XCircle } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminSystemPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
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
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Activity}
          iconClassName="text-averna-neon"
          title={<>Tizim <span className="neon-text">holati</span></>}
          subtitle="Asosiy xizmatlar va platforma maʼlumotlari holati."
        />

        <Card className="glass border-averna-neon/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-neon"><Database className="h-5 w-5" /> Xizmatlar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row ok={dbOk} label="Maʼlumotlar bazasi (Neon PostgreSQL)" detail={dbOk ? "Ulangan" : "Xatolik"} />
            <Row ok={aiOn} label="AI imkoniyatlari (OpenAI)" detail={aiOn ? "GPT-4 faol" : "Oflayn rejim (evristika)"} />
          </CardContent>
        </Card>

        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Activity className="h-5 w-5" /> Platforma maʼlumotlari</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat icon={<Users className="h-4 w-4" />} label="Oʻquvchilar" value={counts.students} />
              <Stat icon={<GraduationCap className="h-4 w-4" />} label="Oʻqituvchilar" value={counts.teachers} />
              <Stat icon={<Layers className="h-4 w-4" />} label="Guruhlar" value={counts.groups} />
              <Stat icon={<Bot className="h-4 w-4" />} label="Yechilgan testlar" value={counts.tests} />
              <Stat icon={<Activity className="h-4 w-4" />} label="Xabarlar" value={counts.messages} />
            </div>
            {!aiOn && (
              <p className="text-xs text-gray-500 mt-4">
                Maslahat: toʻliq AI tahlilini yoqish uchun Vercelʼda <code className="text-averna-cyan">OPENAI_API_KEY</code> qoʻshing. Usiz ham hammasi aqlli evristika orqali ishlaydi.
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
