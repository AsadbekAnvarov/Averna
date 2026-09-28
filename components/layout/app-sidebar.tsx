"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn, initialsOf } from "@/lib/utils";
import {
  LayoutDashboard,
  PenTool,
  BookOpen,
  Headphones,
  Mic,
  Trophy,
  Award,
  Film,
  MessageSquare,
  BarChart,
  User,
  Zap,
  AudioLines,
  Layers,
  UserCheck,
  CalendarClock,
  Gift,
  CalendarDays,
  Crown,
  Swords,
  Library,
  Wallet,
  Bot,
  Users,
  ClipboardCheck,
  Megaphone,
  Notebook,
  ShieldCheck,
  DollarSign,
  Activity,
  Settings,
  Database,
  GraduationCap,
  FolderOpen,
  Bell,
  Menu,
  X,
  TrendingUp,
  Sparkles,
  Newspaper,
  SpellCheck,
  Dna,
  Compass,
  ListChecks,
  BarChart3,
  Send,
  Search,
  type LucideIcon,
} from "lucide-react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { avatarSrc } from "@/lib/avatars";

type NavItem = { name: string; href: string; icon: LucideIcon; badge?: string };
type NavSection = { label: string; items: NavItem[] };

const STUDENT_NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "My Schedule", href: "/schedule", icon: CalendarClock },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "IELTS Skills",
    items: [
      { name: "Reading", href: "/learning/reading", icon: BookOpen },
      { name: "Listening", href: "/learning/listening", icon: Headphones },
      { name: "Writing", href: "/learning/writing", icon: PenTool },
      { name: "Speaking", href: "/learning/speaking", icon: Mic },
      { name: "Pronunciation", href: "/learning/pronunciation", icon: AudioLines },
      { name: "Grammar", href: "/grammar", icon: SpellCheck },
    ],
  },
  {
    label: "Practice & Immersion",
    items: [
      { name: "Mock Exams", href: "/learning/mock-exam", icon: GraduationCap },
      { name: "Placement Test", href: "/learning/placement", icon: Compass },
      { name: "Daily Challenge", href: "/challenge", icon: Zap },
      { name: "Vocabulary", href: "/flashcards", icon: Layers },
      { name: "Daily Article", href: "/article", icon: Newspaper },
      { name: "Movie Time", href: "/movies", icon: Film },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { name: "AI Examiner", href: "/learning/examiner", icon: Bot },
      { name: "AI Mentor", href: "/mentor", icon: Sparkles },
    ],
  },
  {
    label: "My Progress",
    items: [
      { name: "Learning DNA", href: "/learning-dna", icon: Dna, badge: "New" },
      { name: "Progress Tracking", href: "/progress", icon: TrendingUp },
      { name: "Analytics", href: "/analytics", icon: BarChart },
      { name: "Achievements", href: "/achievements", icon: Award },
    ],
  },
  {
    label: "Community",
    items: [
      { name: "Leaderboard", href: "/rankings", icon: Trophy },
      { name: "Leagues", href: "/leagues", icon: Crown },
      { name: "Team Challenge", href: "/team-challenge", icon: Swords },
      { name: "Rewards", href: "/rewards", icon: Gift },
    ],
  },
  {
    label: "Classroom",
    items: [
      { name: "Homework", href: "/homework", icon: Notebook },
      { name: "Materials", href: "/materials", icon: Library },
      { name: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck },
      { name: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Billing", href: "/billing", icon: Wallet },
      { name: "Profile", href: "/profile", icon: User },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const TEACHER_NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
      { name: "Calendar", href: "/teacher/calendar", icon: CalendarDays },
      { name: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Students",
    items: [
      { name: "All Students", href: "/teacher/students", icon: Users },
      { name: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
      { name: "Gradebook", href: "/teacher/gradebook", icon: BookOpen },
    ],
  },
  {
    label: "Teaching",
    items: [
      { name: "Homework", href: "/teacher/homework", icon: Notebook },
      { name: "Create Homework", href: "/teacher/homework/create", icon: PenTool },
      { name: "Review Queue", href: "/teacher/reviews", icon: ListChecks },
      { name: "Mock Results", href: "/teacher/mock", icon: BarChart3 },
      { name: "Lessons Log", href: "/teacher/lessons", icon: GraduationCap },
      { name: "1-on-1 Tutoring", href: "/teacher/tutoring", icon: UserCheck },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Announcements", href: "/teacher/announcements", icon: Megaphone },
      { name: "Messages", href: "/messages", icon: MessageSquare },
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
const ADMIN_NAV: NavSection[] = [
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
      { name: "Oʻqituvchilar", href: "/admin/teachers", icon: GraduationCap },
      { name: "Guruhlar", href: "/admin/groups", icon: Users },
    ],
  },
  {
    label: "Oʻqitish",
    items: [
      { name: "Tekshiruv navbati", href: "/teacher/reviews", icon: ListChecks },
      { name: "Mock natijalari", href: "/teacher/mock", icon: BarChart3 },
      { name: "Kirish testi", href: "/admin/placement", icon: Compass },
    ],
  },
  {
    label: "Kontent",
    items: [
      { name: "Oʻquv kontenti", href: "/admin/content", icon: FolderOpen },
      { name: "Test generatori", href: "/admin/generate-tests", icon: Sparkles },
      { name: "Listening audio", href: "/admin/listening-audio", icon: Headphones },
      { name: "Eʼlonlar", href: "/admin/announcements", icon: Megaphone },
      { name: "Mukofotlar", href: "/admin/rewards", icon: Gift },
    ],
  },
  {
    label: "Operatsiyalar",
    items: [
      { name: "Moliya", href: "/admin/finance", icon: DollarSign },
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

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  // Treat /teacher/homework as active for /teacher/homework/create only if exact prefix
  if (pathname.startsWith(href + "/")) {
    // Avoid matching /dashboard for /dashboard/whatever incorrectly — generic prefix rule works fine
    return true;
  }
  return false;
}

function getNavForRole(role: string | undefined): { sections: NavSection[]; label: string; accent: string } {
  switch (role) {
    case "ADMIN":
      return { sections: ADMIN_NAV, label: "Admin paneli", accent: "averna-purple" };
    case "TEACHER":
      return { sections: TEACHER_NAV, label: "Teacher Portal", accent: "averna-cyan" };
    case "STUDENT":
    default:
      return { sections: STUDENT_NAV, label: "Student Portal", accent: "averna-neon" };
  }
}

function isPublicRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/about");
}

/**
 * Single navigation used across all role portals.
 * - Desktop (lg+): always-visible fixed left rail (w-64).
 * - Mobile: a slim sticky top app bar (menu · brand · search) that opens the
 *   same rail as a drawer. Nothing floats over the page content any more.
 */
export function AppSidebar() {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // While the drawer is open: lock page scroll and close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  if (isPublicRoute(pathname)) return null;
  if (status === "loading") return null;
  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role;
  const { sections, label, accent } = getNavForRole(role);
  const uz = role === "ADMIN";
  const homeHref = role === "ADMIN" ? "/admin/dashboard" : role === "TEACHER" ? "/teacher/dashboard" : "/dashboard";
  const image = avatarSrc(session.user.image);

  return (
    <>
      {/* Mobile top app bar */}
      <header
        className={cn(
          "app-topbar lg:hidden fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]",
          "border-b border-white/[0.06] backdrop-blur-xl"
        )}
      >
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            type="button"
            aria-label={uz ? "Menyuni ochish" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-200 hover:bg-white/5 active:scale-95 transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-bold text-white">Averna</span>
              <span className={cn("block truncate text-[10px] uppercase tracking-wider", `text-${accent}`)}>{label}</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={uz ? "Qidirish" : "Search"}
            onClick={() => window.dispatchEvent(new Event("averna-command-palette"))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-200 hover:bg-white/5 active:scale-95 transition"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Backdrop (mobile) */}
      <div
        aria-hidden
        className={cn(
          "lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        aria-label={uz ? "Navigatsiya" : "Navigation"}
        className={cn(
          "app-sidebar fixed left-0 top-0 z-[55] lg:z-40 h-[100dvh] w-[min(18rem,86vw)] lg:w-64 overflow-y-auto overscroll-contain",
          "border-r border-white/5",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          "lg:translate-x-0 lg:shadow-none"
        )}
      >
        {/* Brand */}
        <div className="px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className={cn("h-9 w-9 rounded-lg grid place-items-center font-bold text-black", `bg-${accent}`)}>
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold text-white leading-tight">Averna</div>
              <div className={cn("text-[10px] uppercase tracking-wider", `text-${accent}`)}>{label}</div>
            </div>
            <button
              type="button"
              aria-label={uz ? "Menyuni yopish" : "Close navigation"}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User strip */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-averna-primary/30 grid place-items-center text-white text-sm font-semibold ring-1 ring-white/10">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(session.user.name ?? session.user.email)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium truncate">{session.user.name ?? "User"}</div>
              <div className="text-[11px] text-gray-500 truncate">{session.user.email}</div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <nav className="px-3 py-4 space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-label px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? cn("bg-white/10 text-white", `border-l-2 border-${accent}`)
                          : "text-gray-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? `text-${accent}` : "text-gray-500 group-hover:text-white"
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-averna-primary/30 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom tab bar — quick access to the 5 most-used student destinations */}
      {role === "STUDENT" && <MobileNav />}
    </>
  );
}

/**
 * Wraps children with the navigation + correct spacing.
 * On phones the content starts below the top app bar (and, for students, ends
 * above the bottom tab bar). `--app-bar-h` lets sticky elements (dashboard tabs,
 * exam timers…) park right under the top bar instead of hiding behind it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  // Reserve the space while the session loads too, so the page doesn't jump.
  const chrome = !isPublicRoute(pathname) && status !== "unauthenticated";
  const isStudent = (session?.user as { role?: string } | undefined)?.role === "STUDENT";

  return (
    <>
      <AppSidebar />
      <div
        className={cn(
          chrome &&
            "lg:pl-64 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0 [--app-bar-h:calc(3.5rem+env(safe-area-inset-top))] lg:[--app-bar-h:0px]",
          chrome && isStudent && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        )}
      >
        {children}
      </div>
    </>
  );
}
