"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PenTool,
  BookOpen,
  Headphones,
  Mic,
  BookMarked,
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
} from "lucide-react";

const studentNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Schedule", href: "/schedule", icon: CalendarClock },
  { name: "Writing", href: "/learning/writing", icon: PenTool },
  { name: "Reading", href: "/learning/reading", icon: BookOpen },
  { name: "Listening", href: "/learning/listening", icon: Headphones },
  { name: "Speaking", href: "/learning/speaking", icon: Mic },
  { name: "Pronunciation", href: "/learning/pronunciation", icon: AudioLines },
  { name: "Daily Challenge", href: "/challenge", icon: Zap },
  { name: "Flashcards", href: "/flashcards", icon: Layers },
  { name: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck },
  { name: "Rewards", href: "/rewards", icon: Gift },
  { name: "Homework", href: "/homework", icon: BookMarked },
  { name: "Rankings", href: "/rankings", icon: Trophy },
  { name: "Achievements", href: "/achievements", icon: Award },
  { name: "Movie Time", href: "/movies", icon: Film },
  { name: "AI Mentor", href: "/mentor", icon: MessageSquare },
  { name: "Analytics", href: "/analytics", icon: BarChart },
  { name: "Profile", href: "/profile", icon: User },
];

export function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed left-0 top-0 h-screen w-64 p-6 space-y-2 overflow-y-auto hidden lg:block">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">
          <span className="text-averna-neon">Averna</span> Learning
        </h2>
        <p className="text-xs text-gray-400 mt-1">Student Portal</p>
      </div>

      {studentNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
              isActive
                ? "bg-averna-primary text-white shadow-neon-green"
                : "text-gray-400 hover:bg-averna-primary/20 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
