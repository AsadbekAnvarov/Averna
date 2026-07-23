import { db } from "@/lib/db";

/**
 * M13 — Content Health / Auto-Repair.
 *
 * Scans real content in the database for integrity problems (misconfigured
 * rewards, empty groups, broken materials, empty/draft tests, stale homework,
 * empty announcements, missing daily article) and returns fix suggestions with
 * deep links. Read-only — it never mutates data; the admin confirms each repair.
 * Uzbek UI strings.
 */

export type HealthSeverity = "high" | "medium" | "low";

export interface HealthIssue {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  action: string;
  href: string;
}

export interface ContentHealth {
  score: number;
  checked: number;
  issues: HealthIssue[];
}

const PENALTY: Record<HealthSeverity, number> = { high: 22, medium: 11, low: 5 };
const RANK: Record<HealthSeverity, number> = { high: 0, medium: 1, low: 2 };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getContentHealth(): Promise<ContentHealth> {
  const now = new Date();
  const today0 = startOfToday();

  const [rewards, groups, staleHw, announcements, materials, generatedTests, todayArticles] = await Promise.all([
    db.reward.findMany({ select: { active: true, cost: true } }),
    db.group.findMany({ select: { id: true, students: { select: { id: true } } } }),
    db.homework.findMany({ where: { dueDate: { lt: now } }, select: { _count: { select: { submissions: true } } } }),
    db.announcement.findMany({ select: { body: true } }),
    db.studyMaterial.findMany({ select: { content: true, url: true } }),
    db.generatedTest.findMany({ select: { published: true, data: true } }),
    db.dailyArticle.count({ where: { date: { gte: today0 } } }),
  ]);

  const issues: HealthIssue[] = [];

  // Rewards
  const activeRewards = rewards.filter((r) => r.active).length;
  const badCost = rewards.filter((r) => r.active && r.cost <= 0).length;
  if (activeRewards === 0) {
    issues.push({
      id: "no-rewards",
      severity: "high",
      title: "Faol mukofot yoʻq",
      detail: "Oʻquvchilar ballarini sarflay olmaydi — motivatsiya pasayadi.",
      action: "Mukofot qoʻshing",
      href: "/admin/rewards",
    });
  }
  if (badCost > 0) {
    issues.push({
      id: "reward-cost",
      severity: "medium",
      title: `${badCost} ta mukofot narxi notoʻgʻri`,
      detail: "Narxi 0 yoki manfiy mukofotlar bepul talab qilinishi mumkin.",
      action: "Narxlarni tuzating",
      href: "/admin/rewards",
    });
  }

  // Groups
  const emptyGroups = groups.filter((g) => g.students.length === 0).length;
  if (emptyGroups > 0) {
    issues.push({
      id: "empty-groups",
      severity: "medium",
      title: `${emptyGroups} ta boʻsh guruh`,
      detail: "Oʻquvchisiz guruhlar hisobotlarni chalkashtiradi.",
      action: "Guruhlarni koʻrish",
      href: "/admin/groups",
    });
  }

  // Homework
  const staleHomework = staleHw.filter((h) => h._count.submissions === 0).length;
  if (staleHomework > 0) {
    issues.push({
      id: "stale-homework",
      severity: "low",
      title: `${staleHomework} ta uy vazifasi eʼtiborsiz qolgan`,
      detail: "Muddati oʻtgan, ammo bironta topshiriq kelmagan.",
      action: "Kontentni koʻrish",
      href: "/admin/content",
    });
  }

  // Announcements
  const shortAnnouncements = announcements.filter((a) => (a.body?.trim().length ?? 0) < 5).length;
  if (shortAnnouncements > 0) {
    issues.push({
      id: "empty-announcements",
      severity: "low",
      title: `${shortAnnouncements} ta boʻsh/qisqa eʼlon`,
      detail: "Matni yoʻq eʼlonlar oʻquvchilarni chalkashtiradi.",
      action: "Eʼlonlarni tahrirlash",
      href: "/admin/announcements",
    });
  }

  // Materials
  const brokenMaterials = materials.filter((m) => !m.content?.trim() && !m.url?.trim()).length;
  if (brokenMaterials > 0) {
    issues.push({
      id: "broken-materials",
      severity: "high",
      title: `${brokenMaterials} ta material ochilmaydi`,
      detail: "Kontent ham, havola ham yoʻq — oʻquvchi hech narsa koʻrmaydi.",
      action: "Materiallarni tuzating",
      href: "/admin/content",
    });
  }

  // Generated tests
  const draftTests = generatedTests.filter((t) => !t.published).length;
  const emptyTests = generatedTests.filter((t) => {
    const d = t.data as unknown;
    if (!d) return true;
    if (typeof d === "object") return Object.keys(d as object).length === 0;
    return false;
  }).length;
  if (emptyTests > 0) {
    issues.push({
      id: "empty-tests",
      severity: "high",
      title: `${emptyTests} ta test boʻsh`,
      detail: "Savollari yoʻq testlar oʻquvchida xatolik keltirib chiqaradi.",
      action: "Testlarni koʻrish",
      href: "/admin/generate-tests",
    });
  }
  if (draftTests > 0) {
    issues.push({
      id: "draft-tests",
      severity: "low",
      title: `${draftTests} ta test nashr etilmagan`,
      detail: "Qoralama testlar oʻquvchilarga koʻrinmaydi.",
      action: "Nashr etish",
      href: "/admin/generate-tests",
    });
  }

  // Daily article
  if (todayArticles === 0) {
    issues.push({
      id: "no-article",
      severity: "medium",
      title: "Bugungi maqola qoʻshilmagan",
      detail: "Kunlik oʻqish bloki boʻsh koʻrinadi.",
      action: "Maqola qoʻshish",
      href: "/admin/content",
    });
  }

  issues.sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  const penalty = issues.reduce((s, i) => s + PENALTY[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { score, checked: 9, issues };
}
