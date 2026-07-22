"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme/theme-provider";
import {
  Search, LayoutDashboard, PenTool, BookOpen, Headphones, Mic, Zap, Layers,
  UserCheck, CalendarClock, Gift, MessageSquare, CalendarDays, Trophy, User, Bell,
  GraduationCap, ClipboardCheck, NotebookPen, PlusCircle, Megaphone, BarChart3,
  Wallet, Activity, ScrollText, Users, Command as CommandIcon, Settings, LogOut,
  Sun, Moon, SpellCheck, Sparkles, CornerDownLeft, ArrowUpDown,
  Library, FileText, Clapperboard, Award, Bot, type LucideIcon,
} from "lucide-react";

type ActionId = "theme" | "signout";
interface Cmd {
  label: string;
  icon: LucideIcon;
  group: string;
  href?: string;
  actionId?: ActionId;
  keywords?: string;
}

const STUDENT_COMMANDS: Cmd[] = [
  { group: "Overview", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home main" },
  { group: "Overview", label: "Learning Center", href: "/learning", icon: GraduationCap, keywords: "practice modules hub all skills" },
  { group: "Overview", label: "My Progress", href: "/progress", icon: BarChart3, keywords: "band rank achievements bests leagues" },
  { group: "Overview", label: "My Schedule", href: "/schedule", icon: CalendarClock, keywords: "attendance grades" },
  { group: "Overview", label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "month deadlines" },
  { group: "Overview", label: "Notifications", href: "/notifications", icon: Bell, keywords: "alerts" },

  { group: "IELTS Skills", label: "Reading", href: "/learning/reading", icon: BookOpen, keywords: "passage test" },
  { group: "IELTS Skills", label: "Listening", href: "/learning/listening", icon: Headphones, keywords: "audio test" },
  { group: "IELTS Skills", label: "Writing", href: "/learning/writing", icon: PenTool, keywords: "essay task" },
  { group: "IELTS Skills", label: "Speaking", href: "/learning/speaking", icon: Mic, keywords: "partner talk" },
  { group: "IELTS Skills", label: "Pronunciation", href: "/learning/pronunciation", icon: Mic, keywords: "record voice" },
  { group: "IELTS Skills", label: "Grammar", href: "/grammar", icon: SpellCheck, keywords: "rules tenses" },

  { group: "Practice", label: "Mock Exam", href: "/learning/mock-exam", icon: Trophy, keywords: "test band full" },
  { group: "Practice", label: "Daily Challenge", href: "/challenge", icon: Zap, keywords: "quiz daily" },
  { group: "Practice", label: "Flashcards", href: "/flashcards", icon: Layers, keywords: "vocabulary words" },
  { group: "Practice", label: "Materials", href: "/materials", icon: Library, keywords: "resources guides bank study" },
  { group: "Practice", label: "Daily Article", href: "/article", icon: FileText, keywords: "reading news read" },
  { group: "Practice", label: "Movies", href: "/movies", icon: Clapperboard, keywords: "films watch subtitles" },

  { group: "AI Tools", label: "AI Mentor", href: "/mentor", icon: Bot, keywords: "ask help chatbot assistant" },
  { group: "AI Tools", label: "AI Examiner", href: "/learning/examiner", icon: Sparkles, keywords: "assess feedback score" },

  { group: "Community", label: "Rankings", href: "/rankings", icon: Trophy, keywords: "leaderboard top" },
  { group: "Community", label: "Leagues", href: "/leagues", icon: Trophy, keywords: "rank division weekly" },
  { group: "Community", label: "Team Challenge", href: "/team-challenge", icon: Users, keywords: "group goal" },
  { group: "Community", label: "Achievements", href: "/achievements", icon: Award, keywords: "badges medals" },
  { group: "Community", label: "Rewards", href: "/rewards", icon: Gift, keywords: "points store prizes" },
  { group: "Community", label: "Certificate", href: "/certificate", icon: Award, keywords: "diploma award download" },

  { group: "Account", label: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck, keywords: "second teacher book" },
  { group: "Account", label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat teacher" },
  { group: "Account", label: "Billing", href: "/billing", icon: Wallet, keywords: "payment balance topup" },
  { group: "Account", label: "My Profile", href: "/profile", icon: User, keywords: "account" },
  { group: "Account", label: "Settings", href: "/settings", icon: Settings, keywords: "preferences theme" },
];

const TEACHER_COMMANDS: Cmd[] = [
  { group: "Overview", label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard, keywords: "home" },
  { group: "Overview", label: "Calendar", href: "/teacher/calendar", icon: CalendarDays, keywords: "schedule" },
  { group: "Overview", label: "Notifications", href: "/notifications", icon: Bell, keywords: "alerts" },

  { group: "Students", label: "Students", href: "/teacher/students", icon: GraduationCap, keywords: "learners" },
  { group: "Students", label: "Take Attendance", href: "/teacher/attendance", icon: ClipboardCheck, keywords: "roll call present" },
  { group: "Students", label: "Gradebook", href: "/teacher/gradebook", icon: NotebookPen, keywords: "grades marks" },

  { group: "Teaching", label: "Create Homework", href: "/teacher/homework/create", icon: PlusCircle, keywords: "assign task new" },
  { group: "Teaching", label: "Grade Submissions", href: "/teacher/homework", icon: ClipboardCheck, keywords: "review score" },
  { group: "Teaching", label: "Lesson Log", href: "/teacher/lessons", icon: BookOpen, keywords: "record" },
  { group: "Teaching", label: "1-on-1 Tutoring", href: "/teacher/tutoring", icon: Users, keywords: "booking slots" },

  { group: "Communication", label: "Announcements", href: "/teacher/announcements", icon: Megaphone, keywords: "broadcast" },
  { group: "Communication", label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat" },
  { group: "Communication", label: "Profile", href: "/teacher/profile", icon: User, keywords: "account" },
];

// Admin commands are in Uzbek — the administrator is a native Uzbek speaker.
const ADMIN_COMMANDS: Cmd[] = [
  { group: "Umumiy koʻrinish", label: "Boshqaruv paneli", href: "/admin/dashboard", icon: LayoutDashboard, keywords: "home bosh" },
  { group: "Umumiy koʻrinish", label: "Tahlil", href: "/admin/analytics", icon: BarChart3, keywords: "stats analytics statistika" },
  { group: "Umumiy koʻrinish", label: "Bildirishnomalar", href: "/notifications", icon: Bell, keywords: "alerts notifications" },

  { group: "Odamlar", label: "Oʻqituvchilar", href: "/admin/teachers", icon: GraduationCap, keywords: "teachers staff" },
  { group: "Odamlar", label: "Guruhlar", href: "/admin/groups", icon: Layers, keywords: "groups classes" },

  { group: "Kontent", label: "Oʻquv kontenti", href: "/admin/content", icon: Layers, keywords: "content lessons materials" },
  { group: "Kontent", label: "Test generatori", href: "/admin/generate-tests", icon: Sparkles, keywords: "ai generate test reading listening writing speaking" },
  { group: "Kontent", label: "Eʼlonlar", href: "/admin/announcements", icon: Megaphone, keywords: "announcements broadcast" },
  { group: "Kontent", label: "Mukofotlar va soʻrovlar", href: "/admin/rewards", icon: Gift, keywords: "rewards redemptions store" },

  { group: "Operatsiyalar", label: "Moliya", href: "/admin/finance", icon: Wallet, keywords: "finance payments revenue" },
  { group: "Operatsiyalar", label: "Tizim holati", href: "/admin/system", icon: Activity, keywords: "system status monitor" },
  { group: "Operatsiyalar", label: "Audit jurnali", href: "/admin/logs", icon: ScrollText, keywords: "audit log history" },
  { group: "Operatsiyalar", label: "Xabarlar", href: "/messages", icon: MessageSquare, keywords: "messages chat" },
];

// Group render order per role
const GROUP_ORDER: Record<string, string[]> = {
  student: ["Overview", "IELTS Skills", "Practice", "AI Tools", "Community", "Account", "Actions"],
  teacher: ["Overview", "Students", "Teaching", "Communication", "Actions"],
  admin: ["Umumiy koʻrinish", "Odamlar", "Kontent", "Operatsiyalar", "Amallar"],
};

/**
 * Single, role-aware command palette. Opens with Cmd/Ctrl+K or the floating
 * "Quick jump" button. Commands are grouped (Linear/Notion style), include
 * quick actions (theme, sign out), support full keyboard control, and the
 * active row auto-scrolls into view.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { mode, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const { baseCommands, roleKey, label } = useMemo(() => {
    if (pathname.startsWith("/admin")) return { baseCommands: ADMIN_COMMANDS, roleKey: "admin", label: "Admin" };
    if (pathname.startsWith("/teacher")) return { baseCommands: TEACHER_COMMANDS, roleKey: "teacher", label: "Teacher" };
    return { baseCommands: STUDENT_COMMANDS, roleKey: "student", label: "" };
  }, [pathname]);

  // Quick actions available in every area (Uzbek for the admin portal)
  const commands: Cmd[] = useMemo(() => {
    const isAdmin = roleKey === "admin";
    const actionsGroup = isAdmin ? "Amallar" : "Actions";
    const themeLabel = isAdmin
      ? mode === "dark"
        ? "Yorugʻ mavzuga oʻtish"
        : "Qorongʻi mavzuga oʻtish"
      : mode === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme";
    const signOutLabel = isAdmin ? "Chiqish" : "Sign out";
    return [
      ...baseCommands,
      { group: actionsGroup, label: themeLabel, icon: mode === "dark" ? Sun : Moon, actionId: "theme", keywords: "theme dark light mode toggle appearance mavzu" },
      { group: actionsGroup, label: signOutLabel, icon: LogOut, actionId: "signout", keywords: "logout exit leave chiqish" },
    ];
  }, [baseCommands, mode, roleKey]);

  const isAdmin = roleKey === "admin";

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

  // Flat, display-ordered list of matches (groups in role order)
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords?.includes(q))
      : commands;
    const order = GROUP_ORDER[roleKey] ?? [];
    return [...matches].sort((a, b) => {
      const ga = order.indexOf(a.group);
      const gb = order.indexOf(b.group);
      return ga - gb;
    });
  }, [query, commands, roleKey]);

  // Keep the active row on-screen
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const select = (cmd: Cmd) => {
    if (cmd.actionId === "theme") { toggleMode(); setOpen(false); return; }
    if (cmd.actionId === "signout") { setOpen(false); signOut({ callbackUrl: "/auth/signin" }); return; }
    if (cmd.href) { setOpen(false); router.push(cmd.href); }
  };

  if (hidden) return null;

  // Build grouped display with a running flat index (for active highlighting)
  let flat = -1;
  const groupsToRender = (GROUP_ORDER[roleKey] ?? []).map((g) => ({
    group: g,
    items: ordered.filter((c) => c.group === g),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      {/* Floating "Quick jump" button — always discoverable */}
      <button
        onClick={() => setOpen(true)}
        className="quick-jump-fab fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full glass-strong border border-averna-neon/30 text-gray-200 shadow-lg hover:border-averna-neon/60 hover:text-white transition-colors"
        aria-label="Open command palette"
      >
        <CommandIcon className="h-4 w-4 text-averna-neon" />
        <span className="hidden sm:inline text-sm">{isAdmin ? "Tezkor oʻtish" : "Quick jump"}</span>
        <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-white/15 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg glass-strong border border-averna-neon/30 rounded-2xl overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <Search className="h-5 w-5 text-averna-neon" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, ordered.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && ordered[active]) select(ordered[active]);
                }}
                placeholder={isAdmin ? "Sahifa va amallarni qidirish…" : "Search pages & actions…"}
                className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none text-sm"
              />
              {label && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-averna-primary/30 text-averna-neon">{label}</span>
              )}
              <kbd className="text-[10px] text-gray-500 border border-white/15 rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {ordered.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">{isAdmin ? `«${query}» boʻyicha natija yoʻq` : `No matches for “${query}”`}</p>
              ) : (
                groupsToRender.map((section) => (
                  <div key={section.group} className="mb-1">
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {section.group}
                    </div>
                    {section.items.map((c) => {
                      flat += 1;
                      const i = flat;
                      const Icon = c.icon;
                      const isActive = i === active;
                      return (
                        <button
                          key={c.group + c.label}
                          ref={isActive ? activeRef : null}
                          onClick={() => select(c)}
                          onMouseEnter={() => setActive(i)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                            isActive ? "bg-averna-primary/30 text-white" : "text-gray-300 hover:bg-white/5"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${c.actionId ? "text-averna-purple" : "text-averna-cyan"}`} />
                          <span className="truncate">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Keyboard hint footer */}
            <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-white/10 text-[10px] text-gray-500">
              <span className="flex items-center gap-1.5"><ArrowUpDown className="h-3 w-3" /> {isAdmin ? "harakat" : "navigate"}</span>
              <span className="flex items-center gap-1.5"><CornerDownLeft className="h-3 w-3" /> {isAdmin ? "ochish" : "open"}</span>
              <span>{ordered.length} {isAdmin ? "natija" : `result${ordered.length === 1 ? "" : "s"}`}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
