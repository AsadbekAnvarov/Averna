export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  Layers,
  UserPlus,
  BarChart3,
  Gift,
  Megaphone,
  Activity,
  Wallet,
  ScrollText,
  ShieldCheck,
  Trophy,
  ArrowRight,
  Sparkles,
  Bell,
  MessageSquare,
  TrendingDown,
  Banknote,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { TopPerformers } from "@/components/top-performers";
import { AdminKpis } from "@/components/admin/kpi-cards";
import { OutcomeKpis } from "@/components/admin/outcome-kpis";
import { ExecutiveOverview } from "@/components/admin/executive-overview";
import { BusinessAi } from "@/components/admin/business-ai";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { EnrollmentFunnel } from "@/components/admin/enrollment-funnel";
import { TeacherWorkload } from "@/components/admin/teacher-workload";
import { FinanceSummary } from "@/components/admin/finance-summary";
import { AdminAttentionBar } from "@/components/admin/attention-bar";
import { SeedDemoButton } from "@/components/admin/seed-demo-button";
import { StudentRoster } from "@/components/admin/student-roster";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { SectionHeader } from "@/components/ui/section-header";
import { PanelTabs } from "@/components/panel-tabs";
import { MissionControl } from "@/components/admin/mission-control";
import { PredictionEngine } from "@/components/admin/prediction-engine";
import { FeatureHeatmap } from "@/components/admin/feature-heatmap";
import { TeacherIntelligence } from "@/components/admin/teacher-intelligence";
import { VoiceControl } from "@/components/admin/voice-control";
import { JourneyReplaySection } from "@/components/admin/journey-replay-section";
import { ContentHealth } from "@/components/admin/content-health";
import { PublishImpactSection } from "@/components/admin/publish-impact-section";
import { InnovationRadar } from "@/components/admin/innovation-radar";
import { recordAudit } from "@/lib/audit";
import { deleteStudentCascade } from "@/lib/cascade-delete";

const LEVELS = [
  "Boshlangʻich (A2)",
  "Oʻrta (B1)",
  "Oʻrtadan yuqori (B2)",
  "Yuqori (C1)",
  "IELTS standart (6.0–6.5)",
  "IELTS yuqori (7.5+)",
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

async function toggleFreeze(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  if (!studentId) return;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { blacklisted: true, user: { select: { name: true } } },
  });
  if (!student) return;

  const next = !student.blacklisted;
  await db.student.update({
    where: { id: studentId },
    data: {
      blacklisted: next,
      // Student UI is English — this is shown to the learner on their dashboard.
      blacklistReason: next ? "Your account is frozen. Please contact the learning centre." : null,
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    next ? "Froze student" : "Unfroze student",
    `name=${student.user.name ?? "?"}`
  );
  revalidatePath("/admin/dashboard");
}

async function deleteStudent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  if (!studentId) return;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true, email: true } } },
  });

  await deleteStudentCascade(studentId);
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted student",
    `name=${student?.user.name ?? "?"} email=${student?.user.email ?? "?"}`
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
        title="Faqat adminlar uchun"
        message="Bu boʻlim faqat administratorlar uchun."
      />
    );
  }

  const [students, groups] = await Promise.all([
    db.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.group.findMany({
      // Use `select` (not `include`) on teacher so we never query teacher
      // scalar columns the dashboard doesn't need (keeps it resilient to
      // schema changes like `ieltsBand`).
      include: { teacher: { select: { user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const pending = students.filter((s) => !s.groupId);
  const firstName = (session.user.name ?? "Admin").split(" ")[0];

  const tabs = [
    { key: "overview", label: "Umumiy", icon: "overview", active: "bg-averna-neon/15 text-averna-neon ring-1 ring-averna-neon/40" },
    { key: "people", label: "Oʻquvchilar", icon: "people", active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
    { key: "insights", label: "Tahlillar", icon: "analytics", active: "bg-averna-purple/15 text-averna-purple ring-1 ring-averna-purple/40" },
    { key: "manage", label: "Boshqarish", icon: "manage", active: "bg-averna-pink/15 text-averna-pink ring-1 ring-averna-pink/40" },
  ];

  const actions = [
    { href: "/admin/analytics", label: "Tahlil", desc: "Platforma tahlili", icon: BarChart3, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
    { href: "/admin/groups", label: "Guruhlar", desc: "Sinflar va jadvallar", icon: Layers, iconBg: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/admin/teachers", label: "Oʻqituvchilar", desc: "Xodimlar akkauntlari", icon: GraduationCap, iconBg: "bg-averna-blue/15 text-averna-blue", hover: "hover:border-averna-blue/40" },
    { href: "/admin/rewards", label: "Mukofotlar va soʻrovlar", desc: "Almashtirishlarni tasdiqlash", icon: Gift, iconBg: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
    { href: "/admin/announcements", label: "Eʼlonlar", desc: "Yangiliklarni tarqatish", icon: Megaphone, iconBg: "bg-orange-400/15 text-orange-400", hover: "hover:border-orange-400/40" },
    { href: "/admin/content", label: "Kontent", desc: "Darslar va materiallar", icon: Layers, iconBg: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/admin/finance", label: "Moliya", desc: "Toʻlovlar va hisob-kitob", icon: Wallet, iconBg: "bg-emerald-400/15 text-emerald-400", hover: "hover:border-emerald-400/40" },
    { href: "/admin/expenses", label: "Xarajatlar", desc: "Xarajatlar va sof foyda", icon: TrendingDown, iconBg: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
    { href: "/admin/payroll", label: "Maoshlar", desc: "Oʻqituvchilar maoshi", icon: Banknote, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
    { href: "/admin/payments", label: "Oʻquvchi toʻlovlari", desc: "Qarzdorlik va muddatlar", icon: CreditCard, iconBg: "bg-averna-blue/15 text-averna-blue", hover: "hover:border-averna-blue/40" },
    { href: "/admin/system", label: "Tizim holati", desc: "Holatni kuzatish", icon: Activity, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
    { href: "/admin/logs", label: "Audit jurnali", desc: "Barcha amallarni kuzatish", icon: ScrollText, iconBg: "bg-gray-400/15 text-gray-300", hover: "hover:border-white/30" },
    { href: "/admin/generate-tests", label: "Test generatori", desc: "Original testlar yaratish", icon: Sparkles, iconBg: "bg-averna-neon/15 text-averna-neon", hover: "hover:border-averna-neon/40" },
    { href: "/notifications", label: "Bildirishnomalar", desc: "Tizim xabarlari", icon: Bell, iconBg: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/messages", label: "Xabarlar", desc: "Oʻquvchilar bilan yozishma", icon: MessageSquare, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  ];

  const rosterGroups = groups.map((g) => ({ id: g.id, name: g.name, teacherName: g.teacher?.user?.name ?? null }));
  const toRoster = (s: (typeof students)[number]) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    level: s.level,
    groupId: s.groupId,
    blacklisted: s.blacklisted,
  });
  const pendingRoster = pending.map(toRoster);
  const studentsRoster = students.map(toRoster);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />

        {/* Welcome banner */}
        <div className="mb-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-averna-purple/10 border border-averna-purple/20 text-averna-purple text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin boshqaruv markazi
            </div>
            <LiveRefresh />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Xush kelibsiz, <span className="neon-text">{firstName}</span>
          </h1>
          <p className="text-gray-400 mt-1">Oʻquvchilar, xodimlar va butun platformani shu yerdan boshqaring.</p>
        </div>

        {/* What needs attention */}
        <div className="mb-4">
          <Suspense fallback={<div className="h-10" />}>
            <AdminAttentionBar />
          </Suspense>
        </div>

        <PanelTabs
          tabs={tabs}
          storageKey="averna_admin_tab"
          content={{
            overview: (
              <>
                <Suspense fallback={<div className="h-72 rounded-2xl bg-white/5 animate-pulse" />}>
                  <ExecutiveOverview />
                </Suspense>
                <BusinessAi />
                <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                  <MissionControl firstName={firstName} />
                </Suspense>
                <AdminKpis />
                <Suspense fallback={<div className="h-32 rounded-2xl bg-white/5 animate-pulse" />}>
                  <OutcomeKpis />
                </Suspense>
                <div className="grid lg:grid-cols-2 gap-6">
                  <ActivityFeed />
                  <FinanceSummary />
                </div>
              </>
            ),
            people: (
              <>
                <div>
                  <SectionHeader icon={UserPlus} title={`Yangi oʻquvchilarni qabul qilish (${pending.length})`} subtitle="Daraja belgilang va guruhga biriktiring" accent="text-averna-pink" />
                  <Card id="enroll" className="glass border-averna-pink/30 scroll-mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-end gap-2">
                        <SeedDemoButton />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StudentRoster
                        students={pendingRoster}
                        groups={rosterGroups}
                        levels={LEVELS}
                        enrollAction={enrollStudent}
                        deleteAction={deleteStudent}
                        freezeAction={toggleFreeze}
                        emptyText="🎉 Qabul kutayotgan oʻquvchilar yoʻq."
                      />
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <SectionHeader icon={Users} title={`Barcha oʻquvchilar (${students.length})`} subtitle="Platformadagi barcha oʻquvchilar" accent="text-averna-cyan" />
                  <Card className="glass border-averna-cyan/30">
                    <CardContent className="pt-6">
                      <StudentRoster
                        students={studentsRoster}
                        groups={rosterGroups}
                        levels={LEVELS}
                        enrollAction={enrollStudent}
                        deleteAction={deleteStudent}
                        freezeAction={toggleFreeze}
                        emptyText="Hozircha oʻquvchilar yoʻq."
                      />
                    </CardContent>
                  </Card>
                </div>
              </>
            ),
            insights: (
              <>
                <div className="grid lg:grid-cols-2 gap-6">
                  <Suspense fallback={<div className="h-72 rounded-2xl bg-white/5 animate-pulse" />}>
                    <PredictionEngine />
                  </Suspense>
                  <Suspense fallback={<div className="h-72 rounded-2xl bg-white/5 animate-pulse" />}>
                    <FeatureHeatmap />
                  </Suspense>
                </div>
                <Suspense fallback={<div className="h-40 rounded-2xl bg-white/5 animate-pulse" />}>
                  <TeacherIntelligence />
                </Suspense>
                <Suspense fallback={<div className="h-72 rounded-2xl bg-white/5 animate-pulse" />}>
                  <JourneyReplaySection />
                </Suspense>
                <div className="grid lg:grid-cols-2 gap-6">
                  <EnrollmentFunnel />
                  <TeacherWorkload />
                </div>
                <Suspense fallback={<div className="h-72 rounded-2xl bg-white/5 animate-pulse" />}>
                  <PublishImpactSection />
                </Suspense>
                <InnovationRadar />
                <div>
                  <SectionHeader icon={Trophy} title="Shon-shuhrat zali" subtitle="Platformadagi eng faol oʻquvchilar" accent="text-amber-400" />
                  <TopPerformers />
                </div>
              </>
            ),
            manage: (
              <>
                <div className="grid lg:grid-cols-2 gap-6">
                  <VoiceControl />
                  <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                    <ContentHealth />
                  </Suspense>
                </div>
                <div>
                <SectionHeader icon={ShieldCheck} title="Boshqaruv vositalari" subtitle="Butun platformani shu yerdan boshqaring" accent="text-averna-purple" />
                <Card className="glass border-averna-primary/30">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {actions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <Link
                            key={action.href}
                            href={action.href}
                            className="group flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/60 hover:-translate-y-1 hover:border-averna-neon/40 hover:shadow-[0_14px_40px_-16px_rgba(0,229,255,0.35)]"
                          >
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 w-full">
                              <p className="font-semibold text-white text-sm truncate">{action.label}</p>
                              <p className="text-[11px] text-gray-400 truncate">{action.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                </div>
              </>
            ),
          }}
        />
      </div>
    </div>
  );
}
