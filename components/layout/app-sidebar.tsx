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
  type LucideIcon,
} from "lucide-react";
import { MobileNav } from "@/components/dashboard/mobile-nav";

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

const ADMIN_NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Analytics", href: "/admin/analytics", icon: BarChart },
      { name: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "People",
    items: [
      { name: "Teachers", href: "/admin/teachers", icon: GraduationCap },
      { name: "Groups", href: "/admin/groups", icon: Users },
    ],
  },
  {
    label: "Content",
    items: [
      { name: "Study Content", href: "/admin/content", icon: FolderOpen },
      { name: "Test Generator", href: "/admin/generate-tests", icon: Sparkles },
      { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
      { name: "Rewards", href: "/admin/rewards", icon: Gift },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Finance", href: "/admin/finance", icon: DollarSign },
      { name: "Audit Logs", href: "/admin/logs", icon: Activity },
      { name: "System", href: "/admin/system", icon: Settings },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Messages", href: "/messages", icon: MessageSquare },
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
      return { sections: ADMIN_NAV, label: "Admin Portal", accent: "averna-purple" };
    case "TEACHER":
      return { sections: TEACHER_NAV, label: "Teacher Portal", accent: "averna-cyan" };
    case "STUDENT":
    default:
      return { sections: STUDENT_NAV, label: "Student Portal", accent: "averna-neon" };
  }
}

/**
 * Single sidebar used across all role portals.
 * - Desktop (lg+): always-visible fixed left rail (w-64).
 * - Mobile: hidden, opened via a floating button → drawer.
 */
export function AppSidebar() {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Hide on public routes + auth pages
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/about");

  if (isPublic) return null;
  if (status === "loading") return null;
  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role;
  const { sections, label, accent } = getNavForRole(role);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setMobileOpen((v) => !v)}
        className={cn(
          "lg:hidden fixed top-3 left-3 z-[60] inline-flex items-center justify-center",
          "h-10 w-10 rounded-lg bg-averna-dark/80 backdrop-blur border border-white/10",
          "text-white shadow-lg hover:bg-averna-dark"
        )}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "app-sidebar fixed left-0 top-0 z-50 h-screen w-64 overflow-y-auto",
          "border-r border-white/5",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className={cn("h-9 w-9 rounded-lg grid place-items-center font-bold text-black", `bg-${accent}`)}>
              A
            </div>
            <div>
              <div className="text-base font-bold text-white leading-tight">Averna</div>
              <div className={cn("text-[10px] uppercase tracking-wider", `text-${accent}`)}>{label}</div>
            </div>
          </div>
        </div>

        {/* User strip */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-averna-primary/30 grid place-items-center text-white text-sm font-semibold">
              {initialsOf(session.user.name ?? session.user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium truncate">{session.user.name ?? "User"}</div>
              <div className="text-[11px] text-gray-500 truncate">{session.user.email}</div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <nav className="px-3 py-4 space-y-5 pb-24">
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
 * Wraps children with sidebar + correct padding.
 * Sidebar handles its own visibility on public routes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/about");

  return (
    <>
      <AppSidebar />
      {/* pb clearance on mobile so content never hides behind the bottom tab bar */}
      <div className={cn(isPublic ? "" : "lg:pl-64 pb-16 lg:pb-0")}>{children}</div>
    </>
  );
}
