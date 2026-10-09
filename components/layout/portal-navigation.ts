import { LayoutDashboard, CalendarDays, Bell, Users, ClipboardCheck, BookOpen, Notebook, ListChecks, BarChart3, GraduationCap, UserCheck, Sparkles, Headphones, Megaphone, MessageSquare, User, Settings, BarChart, Compass, Gift, DollarSign, Activity, Send, type LucideIcon } from "lucide-react";
export type PortalNavSection = { label: string; items: { name: string; href: string; icon: LucideIcon; exact?: boolean }[] };
export const TEACHER_NAV: PortalNavSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
      { name: "Calendar", href: "/teacher/calendar", icon: CalendarDays },
      { name: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Students",
    items: [
      { name: "All Students", href: "/teacher/students", icon: Users },
      { name: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Teaching",
    items: [
      { name: "Homework & Grading", href: "/teacher/homework", icon: Notebook },
      { name: "Gradebook", href: "/teacher/gradebook", icon: BookOpen },
      { name: "Review Queue", href: "/teacher/reviews", icon: ListChecks },
      { name: "Mock Results", href: "/teacher/mock", icon: BarChart3 },
      { name: "Lessons Log", href: "/teacher/lessons", icon: GraduationCap },
      { name: "1-on-1 Tutoring", href: "/teacher/tutoring", icon: UserCheck },
    ],
  },
  {
    label: "Content & Preparation",
    items: [
      { name: "Test Generator", href: "/teacher/generate-tests", icon: Sparkles },
      { name: "Listening Audio", href: "/teacher/listening-audio", icon: Headphones },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Announcements", href: "/teacher/announcements", icon: Megaphone },
      { name: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Profile", href: "/teacher/profile", icon: User },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Admin portal is used by our fully Uzbek-speaking administrator, so its
// navigation is presented entirely in Uzbek (o‘zbekcha).
export const ADMIN_NAV: PortalNavSection[] = [
  {
    label: "Umumiy koʻrinish",
    items: [
      { name: "Boshqaruv paneli", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Tahlil", href: "/admin/analytics", icon: BarChart },
      { name: "Bildirishnomalar", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Odamlar",
    items: [
      { name: "Oʻquvchilar va qabul", href: "/admin/dashboard?tab=people", icon: Users },
      { name: "Oʻqituvchilar", href: "/admin/teachers", icon: GraduationCap },
      { name: "Guruhlar", href: "/admin/groups", icon: Users },
    ],
  },
  {
    label: "Markaz boshqaruvi",
    items: [
      { name: "Moliya", href: "/admin/finance", icon: DollarSign },
      { name: "Kirish testi", href: "/admin/placement", icon: Compass },
      { name: "Mukofotlar", href: "/admin/rewards", icon: Gift },
      { name: "Eʼlonlar", href: "/admin/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Tizim va nazorat",
    items: [
      { name: "Audit jurnali", href: "/admin/logs", icon: Activity },
      { name: "Tizim", href: "/admin/system", icon: Settings },
    ],
  },
  {
    label: "Muloqot",
    items: [
      { name: "Xabarlar", href: "/messages", icon: MessageSquare },
      { name: "Telegram bot", href: "/admin/telegram", icon: Send },
    ],
  },
  {
    label: "Hisob",
    items: [
      { name: "Profil va parol", href: "/admin/profile", icon: User },
    ],
  },
];
