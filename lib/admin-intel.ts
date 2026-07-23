import { db } from "@/lib/db";

/**
 * Mission Control intelligence layer.
 *
 * Aggregates real platform data into an executive briefing, a rule-based
 * critical-event feed, data-derived recommendations and a daily insight — all
 * in one parallel pass. Everything here is READ-ONLY and derived from data that
 * already exists (students, tests, payments, activity), so it is safe and
 * deterministic. All user-facing strings are in Uzbek (admin UI language).
 */

export type Severity = "high" | "medium" | "low";

export interface McEvent {
  id: string;
  severity: Severity;
  title: string;
  impact: string;
  action: string;
  href: string;
}

export interface McRecommendation {
  id: string;
  title: string;
  detail: string;
  expected: string;
  cta: string;
  href: string;
}

export interface McStats {
  totalStudents: number;
  newStudentsToday: number;
  testsToday: number;
  testsThisWeek: number;
  testsLastWeek: number;
  testsTrendPct: number | null;
  submissionsToday: number;
  activeWeek: number;
  inactive14: number;
  revenueWeek: number;
  pendingPayments: number;
  pendingRewards: number;
  unplaced: number;
  peakHour: number | null;
  weakestModule: { module: string; label: string; avg: number } | null;
}

export interface MissionControl {
  stats: McStats;
  bullets: string[];
  priorities: string[];
  risks: string[];
  actions: { text: string; href: string }[];
  events: McEvent[];
  recommendations: McRecommendation[];
  insight: string | null;
}

const MODULE_LABEL_UZ: Record<string, string> = {
  READING: "Oʻqish",
  LISTENING: "Tinglash",
  WRITING: "Yozish",
  SPEAKING: "Gapirish",
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMissionControl(): Promise<MissionControl> {
  const now = new Date();
  const today0 = startOfToday();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

  const [students, tests, submissionsToday, pendingPayments, weekPayments, pendingRewards, teachers, recentActivity] =
    await Promise.all([
      db.student.findMany({ select: { createdAt: true, groupId: true, lastActiveDate: true } }),
      db.iELTSTest.findMany({
        where: { completedAt: { gte: twoWeeksAgo } },
        select: { completedAt: true, module: true, score: true },
      }),
      db.homeworkSubmission.count({ where: { submittedAt: { gte: today0 } } }),
      db.payment.findMany({ where: { status: "PENDING" }, select: { amount: true } }),
      db.payment.findMany({ where: { status: "COMPLETED", createdAt: { gte: weekAgo } }, select: { amount: true } }),
      db.rewardRedemption.count({ where: { status: "PENDING" } }),
      db.teacher.findMany({ select: { groups: { select: { students: { select: { id: true } } } } } }),
      db.activityLog.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    ]);

  // --- Students ---
  const totalStudents = students.length;
  const newStudentsToday = students.filter((s) => s.createdAt >= today0).length;
  const unplaced = students.filter((s) => !s.groupId).length;
  const activeWeek = students.filter((s) => s.lastActiveDate && s.lastActiveDate >= weekAgo).length;
  const inactive14 = students.filter((s) => s.lastActiveDate && s.lastActiveDate < twoWeeksAgo).length;

  // --- Tests ---
  const testsToday = tests.filter((t) => t.completedAt >= today0).length;
  const testsThisWeek = tests.filter((t) => t.completedAt >= weekAgo).length;
  const testsLastWeek = tests.filter((t) => t.completedAt >= twoWeeksAgo && t.completedAt < weekAgo).length;
  const testsTrendPct =
    testsLastWeek === 0 ? (testsThisWeek > 0 ? 100 : null) : Math.round(((testsThisWeek - testsLastWeek) / testsLastWeek) * 100);

  // Weakest module (by average band over the last 14 days)
  const modAgg = new Map<string, { total: number; n: number }>();
  for (const t of tests) {
    const a = modAgg.get(t.module) ?? { total: 0, n: 0 };
    a.total += t.score;
    a.n += 1;
    modAgg.set(t.module, a);
  }
  let weakestModule: McStats["weakestModule"] = null;
  for (const [mod, a] of modAgg) {
    const avg = a.total / a.n;
    if (!weakestModule || avg < weakestModule.avg) {
      weakestModule = { module: mod, label: MODULE_LABEL_UZ[mod] ?? mod, avg: Math.round(avg * 10) / 10 };
    }
  }

  // --- Finance ---
  const revenueWeek = weekPayments.reduce((s, p) => s + p.amount, 0);
  const pendingPaymentsCount = pendingPayments.length;
  const pendingPaymentsTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);

  // --- Teacher load ---
  const loads = teachers.map((t) => t.groups.reduce((s, g) => s + g.students.length, 0));
  const avgLoad = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const overloaded = avgLoad > 0 ? loads.filter((l) => l > avgLoad * 1.5).length : 0;

  // --- Peak activity hour (Tashkent = UTC+5) ---
  const hourBuckets = new Array(24).fill(0);
  for (const a of recentActivity) {
    const h = (new Date(a.createdAt).getUTCHours() + 5) % 24;
    hourBuckets[h] += 1;
  }
  const peakHour = recentActivity.length > 0 ? hourBuckets.indexOf(Math.max(...hourBuckets)) : null;

  const stats: McStats = {
    totalStudents,
    newStudentsToday,
    testsToday,
    testsThisWeek,
    testsLastWeek,
    testsTrendPct,
    submissionsToday,
    activeWeek,
    inactive14,
    revenueWeek,
    pendingPayments: pendingPaymentsCount,
    pendingRewards,
    unplaced,
    peakHour,
    weakestModule,
  };

  // --- Briefing bullets ---
  const bullets: string[] = [
    `Bugun ${testsToday} ta test topshirildi.`,
    `${submissionsToday} ta topshiriq yuborildi.`,
    `${activeWeek} ta oʻquvchi soʻnggi 7 kunda faol boʻldi.`,
    newStudentsToday > 0 ? `${newStudentsToday} ta yangi oʻquvchi qoʻshildi.` : `Bugun yangi oʻquvchi qoʻshilmadi.`,
  ];
  if (testsTrendPct !== null) {
    bullets.push(
      testsTrendPct >= 0
        ? `Test faolligi oʻtgan haftaga nisbatan ${testsTrendPct}% oshdi.`
        : `Test faolligi oʻtgan haftaga nisbatan ${Math.abs(testsTrendPct)}% kamaydi.`,
    );
  }

  // --- Priorities / risks / actions ---
  const priorities: string[] = [];
  const risks: string[] = [];
  const actions: { text: string; href: string }[] = [];

  if (unplaced > 0) {
    priorities.push(`${unplaced} ta oʻquvchini guruhga biriktirish.`);
    actions.push({ text: "Oʻquvchilarni joylashtirish", href: "/admin/dashboard#enroll" });
  }
  if (pendingRewards > 0) {
    priorities.push(`${pendingRewards} ta mukofot soʻrovini koʻrib chiqish.`);
    actions.push({ text: "Mukofotlarni tasdiqlash", href: "/admin/rewards" });
  }
  if (pendingPaymentsCount > 0) {
    priorities.push(`${pendingPaymentsCount} ta toʻlovni tasdiqlash.`);
    actions.push({ text: "Moliyani koʻrish", href: "/admin/finance" });
  }

  if (inactive14 > 0) risks.push(`${inactive14} ta oʻquvchi 2 haftadan beri faol emas — ketib qolish xavfi bor.`);
  if (testsTrendPct !== null && testsTrendPct <= -15) risks.push(`Test faolligi sezilarli kamaydi (${testsTrendPct}%).`);
  if (overloaded > 0) risks.push(`${overloaded} ta oʻqituvchi ortiqcha yuklangan.`);
  if (weakestModule) risks.push(`Eng zaif modul — ${weakestModule.label} (oʻrtacha ${weakestModule.avg} ball).`);

  if (weakestModule) {
    actions.push({ text: `${weakestModule.label} boʻyicha test yaratish`, href: "/admin/generate-tests" });
  }

  // --- Critical events (rule-based) ---
  const events: McEvent[] = [];
  if (unplaced >= 5) {
    events.push({
      id: "unplaced",
      severity: unplaced >= 15 ? "high" : "medium",
      title: `${unplaced} ta oʻquvchi guruhsiz`,
      impact: "Bu oʻquvchilar darslardan va progressdan chetda qolmoqda.",
      action: "Ularni guruhlarga biriktiring.",
      href: "/admin/dashboard#enroll",
    });
  } else if (unplaced > 0) {
    events.push({
      id: "unplaced",
      severity: "low",
      title: `${unplaced} ta oʻquvchi guruhsiz`,
      impact: "Kichik navbat — tez hal qilinadi.",
      action: "Guruhga biriktiring.",
      href: "/admin/dashboard#enroll",
    });
  }
  if (pendingPaymentsCount > 0) {
    events.push({
      id: "payments",
      severity: pendingPaymentsCount >= 10 ? "high" : "medium",
      title: `${pendingPaymentsCount} ta toʻlov tasdiqlanmagan`,
      impact: `${pendingPaymentsTotal.toLocaleString()} ball kutilmoqda.`,
      action: "Toʻlovlarni koʻrib chiqing.",
      href: "/admin/finance",
    });
  }
  if (pendingRewards > 0) {
    events.push({
      id: "rewards",
      severity: pendingRewards >= 8 ? "medium" : "low",
      title: `${pendingRewards} ta mukofot soʻrovi kutilmoqda`,
      impact: "Kechikish oʻquvchilar motivatsiyasini pasaytiradi.",
      action: "Soʻrovlarni tasdiqlang.",
      href: "/admin/rewards",
    });
  }
  if (overloaded > 0) {
    events.push({
      id: "overloaded",
      severity: "medium",
      title: `${overloaded} ta oʻqituvchi ortiqcha yuklangan`,
      impact: "Feedback sifati va tezligi pasayishi mumkin.",
      action: "Yuklamani qayta taqsimlang.",
      href: "/admin/teachers",
    });
  }
  if (inactive14 >= 3) {
    events.push({
      id: "churn",
      severity: inactive14 >= 10 ? "high" : "medium",
      title: `${inactive14} ta oʻquvchi faolsiz (14+ kun)`,
      impact: "Ketib qolish (churn) xavfi yuqori.",
      action: "Eslatma yoki eʼlon yuboring.",
      href: "/admin/announcements",
    });
  }
  if (testsTrendPct !== null && testsTrendPct <= -15) {
    events.push({
      id: "engagement",
      severity: testsTrendPct <= -30 ? "high" : "medium",
      title: `Test faolligi ${Math.abs(testsTrendPct)}% pasaydi`,
      impact: "Oʻquvchilar mashqni kamaytirmoqda.",
      action: "Yangi challenge yoki eʼlon eʼlon qiling.",
      href: "/admin/announcements",
    });
  }
  events.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  // --- Recommendations ---
  const recommendations: McRecommendation[] = [];
  if (weakestModule) {
    recommendations.push({
      id: "weak-module",
      title: `Oʻquvchilar ${weakestModule.label} boʻyicha qiynalmoqda`,
      detail: `Soʻnggi 2 haftadagi oʻrtacha ball — ${weakestModule.avg}. Shu modul boʻyicha qoʻshimcha mashq foydali boʻladi.`,
      expected: "Kutilayotgan yaxshilanish: +0.3–0.5 ball",
      cta: "Test yaratish",
      href: "/admin/generate-tests",
    });
  }
  if (inactive14 >= 3) {
    recommendations.push({
      id: "reengage",
      title: "Faolsiz oʻquvchilarni qaytaring",
      detail: `${inactive14} ta oʻquvchi 2 haftadan beri kirmagan. Shaxsiy eslatma yoki kichik mukofot ularni qaytarishi mumkin.`,
      expected: "Kutilayotgan qaytish: 15–25%",
      cta: "Eʼlon yuborish",
      href: "/admin/announcements",
    });
  }
  if (peakHour !== null) {
    const next = (peakHour + 1) % 24;
    recommendations.push({
      id: "peak-time",
      title: "Eng faol vaqtdan foydalaning",
      detail: `Oʻquvchilar ${peakHour}:00–${next}:00 oraligʻida eng faol. Eʼlon va vazifalarni shu vaqtga rejalashtiring.`,
      expected: "Kutilayotgan ochilish (open rate): +20%",
      cta: "Eʼlon rejalashtirish",
      href: "/admin/announcements",
    });
  }

  // --- Daily insight ---
  let insight: string | null = null;
  if (peakHour !== null) {
    const next = (peakHour + 1) % 24;
    insight = `Oʻquvchilar eng faol vaqti — ${peakHour}:00–${next}:00. Muhim eʼlonlarni shu oraliqda joʻnatsangiz, koʻrilish sezilarli ortadi.`;
  } else if (weakestModule) {
    insight = `Eng koʻp eʼtibor talab qiladigan yoʻnalish — ${weakestModule.label}. Shu modulga fokus qiling.`;
  }

  return { stats, bullets, priorities, risks, actions, events, recommendations, insight };
}
