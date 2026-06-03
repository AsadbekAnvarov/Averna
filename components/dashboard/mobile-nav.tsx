"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarClock, Zap, UserCheck, User } from "lucide-react";

const items = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Schedule", href: "/schedule", icon: CalendarClock },
  { name: "Challenge", href: "/challenge", icon: Zap },
  { name: "Tutor", href: "/tutoring", icon: UserCheck },
  { name: "Profile", href: "/profile", icon: User },
];

/**
 * Fixed bottom navigation bar shown only on small screens (lg:hidden).
 * Gives mobile students quick access to key sections.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-averna-neon/20">
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
