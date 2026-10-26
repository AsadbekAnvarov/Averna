"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { cn, initialsOf } from "@/lib/utils";
import { SessionReturnBar } from "@/components/session/session-return-bar";
import { ReadingRuler } from "@/components/comfort/reading-ruler";
import { ConnectionIndicator } from "@/components/offline/connection-indicator";
import { Menu, X, Search } from "lucide-react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { avatarSrc } from "@/lib/avatars";
import {
  ADMIN_NAV,
  STUDENT_NAV,
  TEACHER_NAV,
  activeNavHref,
  navBadge,
  type PortalNavSection as NavSection,
} from "@/components/layout/portal-navigation";

/**
 * The single nav item to highlight: the most specific (longest) matching
 * route prefix wins — see activeNavHref in portal-navigation.ts.
 */
function activeHref(pathname: string, sections: NavSection[]): string | null {
  return activeNavHref(pathname, sections.flatMap((s) => s.items));
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-200 hover:bg-white/5 active:scale-95 transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* 44 px tall tap target, vertically centred in the 3.5rem bar */}
          <Link href={homeHref} className="inline-flex min-h-[44px] min-w-0 flex-1 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-bold text-white">Averna</span>
              <span className={cn("block truncate text-[11px] uppercase tracking-wider", `text-${accent}`)}>{label}</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={uz ? "Qidirish" : "Search"}
            onClick={() => window.dispatchEvent(new Event("averna-command-palette"))}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-200 hover:bg-white/5 active:scale-95 transition"
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
              <div className={cn("text-[11px] uppercase tracking-wider", `text-${accent}`)}>{label}</div>
            </div>
            <button
              type="button"
              aria-label={uz ? "Menyuni yopish" : "Close navigation"}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden -mr-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
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
        <nav className="px-3 py-3 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-label px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === current;
                  const badge = navBadge(item);
                  return (
                    <div key={item.href}>
                    {item.subgroup && (
                      <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-gray-500">{item.subgroup}</div>
                    )}
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-[44px] lg:min-h-10 items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
                      {badge && (
                        <span className="ml-auto text-[11px] leading-4 px-1.5 py-0.5 rounded-full bg-averna-primary/30 text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                    </div>
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
        {/* "Back to today's session" on pages opened from the Daily Session (?from=session). */}
        {chrome && (
          <Suspense fallback={null}>
            <SessionReturnBar />
          </Suspense>
        )}
        {children}
      </div>
      {/* Settings → Reading comfort → Reading ruler (Alt+R): a fixed overlay over every page. */}
      <ReadingRuler />
      {/* "You're offline — saved lessons still work" / "Back online · syncing N reviews…" (idea 7). */}
      <ConnectionIndicator />
    </>
  );
}
