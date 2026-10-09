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
  Film,
  MessageSquare,
  User,
  Zap,
  AudioLines,
  Layers,
  UserCheck,
  CalendarClock,
  Gift,
  CalendarDays,
  Library,
  Bot,
  Notebook,
  Settings,
  GraduationCap,
  Bell,
  Menu,
  X,
  TrendingUp,
  Sparkles,
  Newspaper,
  SpellCheck,
  Dna,
  Compass,
  Search,
  LayoutGrid,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { avatarSrc } from "@/lib/avatars";

type NavItem = { name: string; href: string; icon: LucideIcon; badge?: string; /** only active on this exact path */ exact?: boolean };
type NavSection = { label: string; items: NavItem[] };
import { ADMIN_NAV, TEACHER_NAV } from "@/components/layout/portal-navigation";

// Five groups, in the order a student thinks about them. Merged pages
// (Analytics → My Progress, Leagues/Team Challenge → Rankings, Achievements →
// My Progress) redirect from their old URLs — see next.config.mjs.
const STUDENT_NAV: NavSection[] = [
  {
    label: "Study",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Learning Center", href: "/learning", icon: LayoutGrid, exact: true },
      { name: "Reading", href: "/learning/reading", icon: BookOpen },
      { name: "Listening", href: "/learning/listening", icon: Headphones },
      { name: "Writing", href: "/learning/writing", icon: PenTool },
      { name: "Speaking", href: "/learning/speaking", icon: Mic },
      { name: "Pronunciation", href: "/learning/pronunciation", icon: AudioLines },
      { name: "Grammar", href: "/grammar", icon: SpellCheck },
      { name: "Vocabulary", href: "/flashcards", icon: Layers },
    ],
  },
  {
    label: "Practice",
    items: [
      { name: "Mock Exams", href: "/learning/mock-exam", icon: GraduationCap },
      { name: "Placement Test", href: "/learning/placement", icon: Compass },
      { name: "Daily Challenge", href: "/challenge", icon: Zap },
      { name: "Practice Studio", href: "/studio", icon: Dumbbell },
      { name: "AI Examiner", href: "/learning/examiner", icon: Bot },
      { name: "AI Mentor", href: "/mentor", icon: Sparkles },
      { name: "Daily Article", href: "/article", icon: Newspaper },
      { name: "Movie Time", href: "/movies", icon: Film },
    ],
  },
  {
    label: "Progress",
    items: [
      { name: "My Progress", href: "/progress", icon: TrendingUp },
      { name: "Learning DNA", href: "/learning-dna", icon: Dna, badge: "New" },
      { name: "Rankings", href: "/rankings", icon: Trophy },
      { name: "Rewards", href: "/rewards", icon: Gift },
    ],
  },
  {
    label: "Class",
    items: [
      { name: "Homework", href: "/homework", icon: Notebook },
      { name: "My Schedule", href: "/schedule", icon: CalendarClock },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Materials", href: "/materials", icon: Library },
      { name: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck },
      { name: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Notifications", href: "/notifications", icon: Bell },
      { name: "Profile", href: "/profile", icon: User },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];


function matches(pathname: string, item: NavItem): boolean {
  if (item.href.includes("?")) return false; // query-only shortcuts must not highlight the whole dashboard
  if (item.href === pathname) return true;
  return !item.exact && pathname.startsWith(item.href + "/");
}

/**
 * The single nav item to highlight: the most specific match wins, so
 * /teacher/homework/create lights up "Create Homework" only (not "Homework"
 * too), and /learning/reading lights up "Reading", not "Learning Center".
 */
function activeHref(pathname: string, sections: NavSection[]): string | null {
  let best: string | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (matches(pathname, item) && (!best || item.href.length > best.length)) best = item.href;
    }
  }
  return best;
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

/** Roles that get the phone bottom tab bar. */
function hasTabBar(role: string | undefined): role is "STUDENT" | "TEACHER" | "ADMIN" {
  return role === "STUDENT" || role === "TEACHER" || role === "ADMIN";
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
  const current = activeHref(pathname, sections);
  const uz = role === "ADMIN";
  const homeHref = role === "ADMIN" ? "/admin/dashboard" : role === "TEACHER" ? "/teacher/dashboard" : "/dashboard";
  const image = avatarSrc(session.user.image);

  return (
    <>
      {/* Mobile top app bar */}
      <header
        className={cn(
          "app-topbar lg:hidden fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
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
          "app-sidebar fixed left-0 top-0 z-[55] lg:z-40 h-[100dvh] w-[min(18rem,86vw)] lg:w-64 overflow-y-auto overscroll-contain pl-[env(safe-area-inset-left)]",
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
                  const active = item.href === current;
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

      {/* Mobile bottom tab bar — the 5 most-used destinations of this role */}
      {hasTabBar(role) && <MobileNav role={role} />}
    </>
  );
}

/**
 * Wraps children with the navigation + correct spacing.
 * On phones the content starts below the top app bar and ends above the
 * bottom tab bar. `--app-bar-h` lets sticky elements (dashboard tabs,
 * exam timers…) park right under the top bar instead of hiding behind it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  // Reserve the space while the session loads too, so the page doesn't jump.
  const chrome = !isPublicRoute(pathname) && status !== "unauthenticated";
  const tabBar = hasTabBar((session?.user as { role?: string } | undefined)?.role);

  return (
    <>
      <AppSidebar />
      <div
        className={cn(
          chrome &&
            "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:pl-64 lg:pr-0 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0 [--app-bar-h:calc(3.5rem+env(safe-area-inset-top))] lg:[--app-bar-h:0px]",
          chrome && tabBar && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        )}
      >
        {children}
      </div>
    </>
  );
}
