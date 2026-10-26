import { LayoutDashboard, CalendarDays, Bell, Users, ClipboardCheck, BookOpen, Notebook, ListChecks, BarChart3, GraduationCap, UserCheck, Sparkles, Headphones, Megaphone, MessageSquare, User, Settings, BarChart, Compass, Gift, Activity, Send, Mic, PenTool, SpellCheck, Layers, Dumbbell, Bot, TrendingUp, Trophy, LayoutGrid, type LucideIcon } from "lucide-react";

export type PortalNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Only active on this exact path. */
  exact?: boolean;
  /** Other route prefixes that belong to this item (hub children), e.g. /notifications → Inbox. */
  also?: string[];
  /** Small caption shown above the first item of a sub-group inside a section. */
  subgroup?: string;
  /** Genuinely new on this branch: shows a "New" badge until NEW_BADGE_UNTIL. */
  fresh?: boolean;
};
export type PortalNavSection = { label: string; items: PortalNavItem[] };

/** "New" badges switch themselves off after this day (30 days after AI Coach + Speaking partner shipped). */
export const NEW_BADGE_UNTIL = "2026-11-25";

export function isStillNew(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(`${NEW_BADGE_UNTIL}T00:00:00Z`);
}

/** The badge an item shows right now, if any. */
export function navBadge(item: Pick<PortalNavItem, "fresh">, now: Date = new Date()): string | undefined {
  return item.fresh && isStillNew(now) ? "New" : undefined;
}

/**
 * How specifically `pathname` matches an item: the length of the matching
 * route prefix (its href or one of its `also` prefixes), or -1 for no match.
 * Query-only shortcuts (href with "?") never highlight.
 */
export function navMatchLength(pathname: string, item: Pick<PortalNavItem, "href" | "exact" | "also">): number {
  if (item.href.includes("?")) return -1;
  let best = -1;
  for (const prefix of [item.href, ...(item.exact ? [] : item.also ?? [])]) {
    const hit = pathname === prefix || (!(item.exact && prefix === item.href) && pathname.startsWith(prefix + "/"));
    if (hit && prefix.length > best) best = prefix.length;
  }
  return best;
}

/**
 * The single item to highlight: the most specific (longest) matching prefix
 * wins, so /studio/essay-xray lights up "AI Coach" (its hub) rather than
 * "Practice Studio", and /teacher/homework/create lights up only "Homework".
 */
export function activeNavHref(pathname: string, items: Pick<PortalNavItem, "href" | "exact" | "also">[]): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    const len = navMatchLength(pathname, item);
    if (len > bestLen) {
      best = item.href;
      bestLen = len;
    }
  }
  return best;
}

/**
 * Student sidebar: five calm sections, 16 items. Rarely used pages live in
 * their hub instead (Coach → /coach, Practice Studio → /studio, Skills →
 * /learning, Speaking → /learning/speaking, Calendar → /schedule) and stay
 * findable in the ⌘K palette.
 */
export const STUDENT_NAV: PortalNavSection[] = [
  {
    label: "Home",
    items: [
      { name: "Today", href: "/dashboard", icon: LayoutDashboard, also: ["/study", "/checkin"] },
      { name: "Homework", href: "/homework", icon: Notebook },
      { name: "Calendar", href: "/calendar", icon: CalendarDays, also: ["/schedule"] },
      { name: "Inbox", href: "/messages", icon: MessageSquare, also: ["/notifications"] },
    ],
  },
  {
    label: "Skills",
    items: [
      { name: "Reading", href: "/learning/reading", icon: BookOpen, also: ["/article"] },
      { name: "Listening", href: "/learning/listening", icon: Headphones },
      { name: "Writing", href: "/learning/writing", icon: PenTool },
      { name: "Speaking", href: "/learning/speaking", icon: Mic, fresh: true, also: ["/learning/speaking-test", "/learning/pronunciation"] },
      { name: "Grammar", href: "/grammar", icon: SpellCheck, subgroup: "Language" },
      { name: "Vocabulary", href: "/flashcards", icon: Layers },
    ],
  },
  {
    label: "Practice",
    items: [
      { name: "Mock exams", href: "/learning/mock-exam", icon: GraduationCap, also: ["/learning/placement"] },
      { name: "Practice Studio", href: "/studio", icon: Dumbbell, also: ["/challenge", "/movies", "/rewards"] },
    ],
  },
  {
    label: "Coach",
    items: [
      { name: "AI Coach", href: "/coach", icon: Bot, fresh: true, also: ["/mentor", "/learning/examiner", "/studio/essay-xray", "/studio/roleplay", "/learning-dna", "/tutoring"] },
    ],
  },
  {
    label: "Me",
    items: [
      { name: "Progress", href: "/progress", icon: TrendingUp, also: ["/certificate"] },
      { name: "Rankings", href: "/rankings", icon: Trophy },
      { name: "Profile", href: "/profile", icon: User, also: ["/settings"] },
    ],
  },
];

/** Student phone bottom tab bar: one tab per sidebar section. */
export const STUDENT_TABS: PortalNavItem[] = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard, also: ["/homework", "/calendar", "/schedule", "/messages", "/notifications", "/study", "/checkin"] },
  { name: "Skills", href: "/learning", icon: LayoutGrid, also: ["/grammar", "/flashcards", "/article", "/materials"] },
  { name: "Practice", href: "/studio", icon: Dumbbell, also: ["/learning/mock-exam", "/learning/placement", "/challenge", "/movies", "/rewards"] },
  { name: "Coach", href: "/coach", icon: Bot, also: ["/mentor", "/learning/examiner", "/studio/essay-xray", "/studio/roleplay", "/learning-dna", "/tutoring"] },
  { name: "Me", href: "/progress", icon: TrendingUp, also: ["/rankings", "/profile", "/settings", "/certificate"] },
];

export const TEACHER_NAV: PortalNavSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
      { name: "Calendar", href: "/teacher/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Students",
    items: [
      { name: "All Students", href: "/teacher/students", icon: Users },
      { name: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
      { name: "Peer Speaking", href: "/teacher/speaking", icon: Mic },
    ],
  },
  {
    label: "Teaching",
    items: [
      { name: "Homework & Grading", href: "/teacher/homework", icon: Notebook },
      { name: "Gradebook", href: "/teacher/gradebook", icon: BookOpen },
      { name: "Review Queue", href: "/teacher/reviews", icon: ListChecks },
      { name: "Mock Results", href: "/teacher/mock", icon: BarChart3 },
      { name: "Lessons Log", href: "/teacher/lessons", icon: GraduationCap },
      { name: "1-on-1 Tutoring", href: "/teacher/tutoring", icon: UserCheck },
    ],
  },
  {
    label: "Content & Preparation",
    items: [
      { name: "Test Generator", href: "/teacher/generate-tests", icon: Sparkles },
      { name: "Student Workshops", href: "/teacher/adventures", icon: Compass },
      { name: "Listening Audio", href: "/teacher/listening-audio", icon: Headphones },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Announcements", href: "/teacher/announcements", icon: Megaphone },
      // Messages + Notifications share one inbox (tabs on both pages).
      { name: "Inbox", href: "/messages", icon: MessageSquare, also: ["/notifications"] },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Profile", href: "/teacher/profile", icon: User },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Admin portal is used by our fully Uzbek-speaking administrator, so its
// navigation is presented entirely in Uzbek (o‘zbekcha).
export const ADMIN_NAV: PortalNavSection[] = [
  {
    label: "Umumiy koʻrinish",
    items: [
      { name: "Boshqaruv paneli", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Tahlil", href: "/admin/analytics", icon: BarChart },
      { name: "Bildirishnomalar", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Odamlar",
    items: [
      { name: "Oʻquvchilar va qabul", href: "/admin/dashboard?tab=people", icon: Users },
      { name: "Oʻqituvchilar", href: "/admin/teachers", icon: GraduationCap },
      { name: "Guruhlar", href: "/admin/groups", icon: Users },
    ],
  },
  {
    label: "Markaz boshqaruvi",
    items: [
      { name: "Kirish testi", href: "/admin/placement", icon: Compass },
      { name: "Mukofotlar", href: "/admin/rewards", icon: Gift },
      { name: "Eʼlonlar", href: "/admin/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Tizim va nazorat",
    items: [
      { name: "Audit jurnali", href: "/admin/logs", icon: Activity },
      { name: "Tizim", href: "/admin/system", icon: Settings },
    ],
  },
  {
    label: "Muloqot",
    items: [
      { name: "Xabarlar", href: "/messages", icon: MessageSquare },
      { name: "Telegram bot", href: "/admin/telegram", icon: Send },
    ],
  },
  {
    label: "Hisob",
    items: [
      { name: "Profil va parol", href: "/admin/profile", icon: User },
    ],
  },
];
