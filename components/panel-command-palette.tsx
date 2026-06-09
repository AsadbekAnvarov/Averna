"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, GraduationCap, Layers, BarChart3, Gift,
  Megaphone, Activity, Wallet, ScrollText, ClipboardCheck, BookOpen, NotebookPen,
  CalendarDays, MessageSquare, PlusCircle, Command,
} from "lucide-react";

interface Cmd { label: string; href: string; icon: any; keywords?: string }

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
  { label: "Students", href: "/admin/dashboard", icon: Users, keywords: "enroll" },
];

/**
 * Role-aware command palette for the teacher/admin panels. Opens with Cmd/Ctrl+K
 * (or the floating hint button) and lets staff jump anywhere instantly.
 */
export function PanelCommandPalette({ role }: { role: "TEACHER" | "ADMIN" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = role === "ADMIN" ? ADMIN_COMMANDS : TEACHER_COMMANDS;

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
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords?.includes(q));
  }, [query, commands]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Floating hint button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full glass-strong border border-averna-neon/30 text-gray-200 shadow-lg hover:border-averna-neon/60 hover:text-white transition-colors"
        aria-label="Open command palette"
      >
        <Command className="h-4 w-4 text-averna-neon" />
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && results[active]) go(results[active].href);
                }}
                placeholder={role === "ADMIN" ? "Jump to… (try 'finance', 'groups')" : "Jump to… (try 'attendance', 'grade')"}
                className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none text-sm"
              />
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
