"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, LayoutDashboard, PenTool, BookOpen, Headphones, Mic, Zap, Layers,
  UserCheck, CalendarClock, Gift, MessageSquare, CalendarDays, Trophy, User, Bell,
  GraduationCap, ClipboardCheck, NotebookPen, PlusCircle, Megaphone, BarChart3,
  Wallet, Activity, ScrollText, Users, Command as CommandIcon,
  Library, FileText, Clapperboard, Award, Bot,
} from "lucide-react";

interface Cmd { label: string; href: string; icon: any; keywords?: string }

const STUDENT_COMMANDS: Cmd[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home main" },
  { label: "My Schedule", href: "/schedule", icon: CalendarClock, keywords: "attendance grades" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "month deadlines" },
  { label: "Writing", href: "/learning/writing", icon: PenTool, keywords: "essay task" },
  { label: "Reading", href: "/learning/reading", icon: BookOpen, keywords: "passage test" },
  { label: "Listening", href: "/learning/listening", icon: Headphones, keywords: "audio test" },
  { label: "Speaking", href: "/learning/speaking", icon: Mic, keywords: "partner talk" },
  { label: "Pronunciation", href: "/learning/pronunciation", icon: Mic, keywords: "record voice" },
  { label: "Mock Exam", href: "/learning/mock-exam", icon: Trophy, keywords: "test band" },
  { label: "Daily Challenge", href: "/challenge", icon: Zap, keywords: "quiz daily" },
  { label: "Flashcards", href: "/flashcards", icon: Layers, keywords: "vocabulary words" },
  { label: "Materials", href: "/materials", icon: Library, keywords: "resources guides bank study" },
  { label: "Daily Article", href: "/article", icon: FileText, keywords: "reading news read" },
  { label: "Movies", href: "/movies", icon: Clapperboard, keywords: "films watch subtitles" },
  { label: "AI Mentor", href: "/mentor", icon: Bot, keywords: "ask help chatbot assistant" },
  { label: "Leagues", href: "/leagues", icon: Trophy, keywords: "rank division weekly" },
  { label: "Team Challenge", href: "/team-challenge", icon: Users, keywords: "group goal" },
  { label: "Achievements", href: "/achievements", icon: Award, keywords: "badges medals" },
  { label: "Rankings", href: "/rankings", icon: Trophy, keywords: "leaderboard top" },
  { label: "Certificate", href: "/certificate", icon: Award, keywords: "diploma award download" },
  { label: "Billing", href: "/billing", icon: Wallet, keywords: "payment balance topup" },
  { label: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck, keywords: "second teacher book" },
  { label: "Rewards", href: "/rewards", icon: Gift, keywords: "points store prizes" },
  { label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat teacher" },
  { label: "Notifications", href: "/notifications", icon: Bell, keywords: "alerts" },
  { label: "My Profile", href: "/profile", icon: User, keywords: "settings account" },
];

const TEACHER_COMMANDS: Cmd[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard, keywords: "home" },
  { label: "Create Homework", href: "/teacher/homework/create", icon: PlusCircle, keywords: "assign task new" },
  { label: "Grade Submissions", href: "/teacher/homework", icon: ClipboardCheck, keywords: "review score" },
  { label: "Students", href: "/teacher/students", icon: GraduationCap, keywords: "learners" },
  { label: "Take Attendance", href: "/teacher/attendance", icon: ClipboardCheck, keywords: "roll call present" },
  { label: "Gradebook", href: "/teacher/gradebook", icon: NotebookPen, keywords: "grades marks" },
  { label: "Lesson Log", href: "/teacher/lessons", icon: BookOpen, keywords: "record" },
  { label: "1-on-1 Tutoring", href: "/teacher/tutoring", icon: Users, keywords: "booking slots" },
  { label: "Announcements", href: "/teacher/announcements", icon: Megaphone, keywords: "broadcast" },
  { label: "Calendar", href: "/teacher/calendar", icon: CalendarDays, keywords: "schedule" },
  { label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat" },
];

const ADMIN_COMMANDS: Cmd[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, keywords: "home" },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, keywords: "stats insights" },
  { label: "Manage Groups", href: "/admin/groups", icon: Layers, keywords: "classes" },
  { label: "Manage Teachers", href: "/admin/teachers", icon: GraduationCap, keywords: "staff" },
  { label: "Rewards & Requests", href: "/admin/rewards", icon: Gift, keywords: "redemptions store" },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone, keywords: "broadcast" },
  { label: "Manage Content", href: "/admin/content", icon: Layers, keywords: "lessons materials" },
  { label: "Finance", href: "/admin/finance", icon: Wallet, keywords: "payments revenue billing" },
  { label: "System Health", href: "/admin/system", icon: Activity, keywords: "status monitor" },
  { label: "Audit Log", href: "/admin/logs", icon: ScrollText, keywords: "history actions" },
  { label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat" },
];

/**
 * Single, role-aware command palette. Opens with Cmd/Ctrl+K or the floating
 * "Quick jump" button. The command set adapts to the current area (admin /
 * teacher / student) based on the pathname.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const { commands, label } = useMemo(() => {
    if (pathname.startsWith("/admin")) return { commands: ADMIN_COMMANDS, label: "Admin" };
    if (pathname.startsWith("/teacher")) return { commands: TEACHER_COMMANDS, label: "Teacher" };
    return { commands: STUDENT_COMMANDS, label: "" };
  }, [pathname]);

  // Hide the palette entirely on auth/marketing routes
  const hidden = pathname === "/" || pathname.startsWith("/auth");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setActive(0); }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords?.includes(q)
    );
  }, [query, commands]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  if (hidden) return null;

  return (
    <>
      {/* Floating "Quick jump" button — always discoverable */}
      <button
        onClick={() => setOpen(true)}
        className="quick-jump-fab fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full glass-strong border border-averna-neon/30 text-gray-200 shadow-lg hover:border-averna-neon/60 hover:text-white transition-colors"
        aria-label="Open command palette"
      >
        <CommandIcon className="h-4 w-4 text-averna-neon" />
        <span className="hidden sm:inline text-sm">Quick jump</span>
        <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-white/15 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg glass-strong border border-averna-neon/30 rounded-2xl overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <Search className="h-5 w-5 text-averna-neon" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && results[active]) go(results[active].href);
                }}
                placeholder="Jump to…"
                className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none text-sm"
              />
              {label && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-averna-primary/30 text-averna-neon">{label}</span>
              )}
              <kbd className="text-[10px] text-gray-500 border border-white/15 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">No matches</p>
              ) : (
                results.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.href + c.label}
                      onClick={() => go(c.href)}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${
                        i === active ? "bg-averna-primary/30 text-white" : "text-gray-300"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-averna-cyan" />
                      {c.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
