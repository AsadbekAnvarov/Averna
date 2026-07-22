"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, GraduationCap, Zap, TrendingUp, User } from "lucide-react";

const items = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Learn", href: "/learning", icon: GraduationCap },
  { name: "Challenge", href: "/challenge", icon: Zap },
  { name: "Progress", href: "/progress", icon: TrendingUp },
  { name: "Profile", href: "/profile", icon: User },
];

/**
 * Fixed bottom navigation bar shown only on small screens (lg:hidden).
 * Gives mobile students one-tap access to the five most-used destinations.
 * Kept at z-30 so the full-menu drawer (z-50) and its backdrop (z-40) sit
 * above it while the drawer is open.
 */
export function MobileNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-averna-neon/20 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-1 py-2 px-1 flex-1 text-[10px] active:scale-95 transition-transform"
            >
              {/* Top active indicator */}
              <span
                className={cn(
                  "absolute top-0 h-0.5 rounded-full bg-averna-neon transition-all duration-300",
                  active ? "w-8 opacity-100" : "w-0 opacity-0"
                )}
              />
              {/* Icon in a neon-tinted pill when active */}
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                  active
                    ? "bg-averna-neon/15 text-averna-neon shadow-[0_0_18px_-5px_rgba(0,255,148,0.7)] -translate-y-0.5"
                    : "text-gray-400"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn("transition-colors", active ? "text-averna-neon font-medium" : "text-gray-400")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
