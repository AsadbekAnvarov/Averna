"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, PenTool, BookOpen, Headphones, Mic, Zap, Layers,
  UserCheck, CalendarClock, Gift, MessageSquare, CalendarDays, Trophy, User, Bell,
} from "lucide-react";

interface Cmd { label: string; href: string; icon: any; keywords?: string }

const COMMANDS: Cmd[] = [
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
  { label: "1-on-1 Tutoring", href: "/tutoring", icon: UserCheck, keywords: "second teacher book" },
  { label: "Rewards", href: "/rewards", icon: Gift, keywords: "points store prizes" },
  { label: "Messages", href: "/messages", icon: MessageSquare, keywords: "chat teacher" },
  { label: "Notifications", href: "/notifications", icon: Bell, keywords: "alerts" },
  { label: "My Profile", href: "/profile", icon: User, keywords: "settings account" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

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
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords?.includes(q)
    );
  }, [query]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  if (!open) return null;

  return (
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
            placeholder="Jump to… (try 'speaking', 'rewards')"
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
                  key={c.href}
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
  );
}
