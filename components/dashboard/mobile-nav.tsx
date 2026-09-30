"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, GraduationCap, Dumbbell, TrendingUp, User, Users, ListChecks, Notebook,
  MessageSquare, DollarSign, BarChart, type LucideIcon,
} from "lucide-react";

type Role = "STUDENT" | "TEACHER" | "ADMIN";
type Item = { name: string; href: string; icon: LucideIcon };

// The five destinations each role uses most. Admin labels are Uzbek, like the
// rest of the admin panel.
const ITEMS: Record<Role, Item[]> = {
  STUDENT: [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Learn", href: "/learning", icon: GraduationCap },
    { name: "Practice", href: "/studio", icon: Dumbbell },
    { name: "Progress", href: "/progress", icon: TrendingUp },
    { name: "Profile", href: "/profile", icon: User },
  ],
  TEACHER: [
    { name: "Home", href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: "Students", href: "/teacher/students", icon: Users },
    { name: "Reviews", href: "/teacher/reviews", icon: ListChecks },
    { name: "Homework", href: "/teacher/homework", icon: Notebook },
    { name: "Messages", href: "/messages", icon: MessageSquare },
  ],
  ADMIN: [
    { name: "Panel", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Guruhlar", href: "/admin/groups", icon: Users },
    { name: "Moliya", href: "/admin/finance", icon: DollarSign },
    { name: "Tahlil", href: "/admin/analytics", icon: BarChart },
    { name: "Xabarlar", href: "/messages", icon: MessageSquare },
  ],
};

const ACCENT: Record<Role, { text: string; pill: string; bar: string; border: string }> = {
  STUDENT: { text: "text-averna-neon", pill: "bg-averna-neon/15 text-averna-neon", bar: "bg-averna-neon", border: "border-averna-neon/20" },
  TEACHER: { text: "text-averna-cyan", pill: "bg-averna-cyan/15 text-averna-cyan", bar: "bg-averna-cyan", border: "border-averna-cyan/20" },
  ADMIN: { text: "text-averna-purple", pill: "bg-averna-purple/15 text-averna-purple", bar: "bg-averna-purple", border: "border-averna-purple/20" },
};

/**
 * Fixed bottom tab bar on small screens (lg:hidden) for every role: one-tap
 * access to the five most-used destinations. Kept at z-30 so the full-menu
 * drawer (z-55) and its backdrop (z-50) sit above it while the drawer is open.
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname() || "";
  const items = ITEMS[role];
  const accent = ACCENT[role];
  // Most specific match wins (e.g. /teacher/homework/create → Homework).
  const current = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={role === "ADMIN" ? "Asosiy boʻlimlar" : "Primary"}
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        accent.border
      )}
    >
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === current;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-transform active:scale-95"
            >
              {/* Top active indicator */}
              <span
                className={cn(
                  "absolute top-0 h-0.5 rounded-full transition-all duration-300",
                  accent.bar,
                  active ? "w-8 opacity-100" : "w-0 opacity-0"
                )}
              />
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                  active ? cn(accent.pill, "-translate-y-0.5") : "text-gray-400"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn("max-w-full truncate transition-colors", active ? cn(accent.text, "font-medium") : "text-gray-400")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
