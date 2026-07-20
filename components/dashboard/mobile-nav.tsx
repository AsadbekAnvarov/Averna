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
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-2 flex-1 text-[10px] transition-colors",
                active ? "text-averna-neon" : "text-gray-400 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
