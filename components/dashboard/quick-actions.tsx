import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PenTool, BookOpen, Headphones, Mic, Trophy, MessageSquare, Zap, Layers,
  UserCheck, CalendarClock, Gift, CalendarDays, Crown, Swords, Library, Bot,
  GraduationCap, Gamepad2, Wrench, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { isSpeakingTime, getTimeUntilSpeakingTime } from "@/lib/utils";

interface Action {
  icon: any;
  label: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  live?: boolean;
}

export function QuickActions() {
  const speakingTimeActive = isSpeakingTime();
  const speakingTimeText = getTimeUntilSpeakingTime();

  const practice: Action[] = [
    { icon: PenTool, label: "Writing", description: "Practice Task 1 & 2", href: "/learning/writing", color: "text-purple-400", bgColor: "bg-purple-500/15" },
    { icon: BookOpen, label: "Reading", description: "Take a reading test", href: "/learning/reading", color: "text-blue-400", bgColor: "bg-blue-500/15" },
    { icon: Headphones, label: "Listening", description: "Practice listening", href: "/learning/listening", color: "text-green-400", bgColor: "bg-green-500/15" },
    { icon: Mic, label: "Speaking", description: speakingTimeText, href: "/learning/speaking", color: speakingTimeActive ? "text-averna-neon" : "text-orange-400", bgColor: speakingTimeActive ? "bg-averna-neon/15" : "bg-orange-500/15", live: speakingTimeActive },
    { icon: Mic, label: "Pronunciation", description: "Speak & get scored", href: "/learning/pronunciation", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
    { icon: Bot, label: "AI Examiner", description: "Speak, get a band", href: "/learning/examiner", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
    { icon: Trophy, label: "Mock Exam", description: "Timed mini IELTS test", href: "/learning/mock-exam", color: "text-yellow-400", bgColor: "bg-yellow-500/15" },
  ];

  const compete: Action[] = [
    { icon: Zap, label: "Daily Challenge", description: "Test yourself today", href: "/challenge", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
    { icon: Trophy, label: "Rankings", description: "View leaderboards", href: "/rankings", color: "text-yellow-400", bgColor: "bg-yellow-500/15" },
    { icon: Crown, label: "Leagues", description: "Weekly season league", href: "/leagues", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
    { icon: Swords, label: "Team Challenge", description: "Group vs group race", href: "/team-challenge", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
  ];

  const tools: Action[] = [
    { icon: Layers, label: "Flashcards", description: "Master vocabulary", href: "/flashcards", color: "text-averna-purple", bgColor: "bg-averna-purple/15" },
    { icon: Library, label: "Materials", description: "IELTS guides & lists", href: "/materials", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
    { icon: Bot, label: "AI Mentor", description: "Get instant help", href: "/mentor", color: "text-averna-neon", bgColor: "bg-averna-neon/15" },
    { icon: UserCheck, label: "Second Teacher", description: "Book 1-on-1 practice", href: "/tutoring", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
    { icon: CalendarClock, label: "My Schedule", description: "Lessons & attendance", href: "/schedule", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
    { icon: CalendarDays, label: "Calendar", description: "Lessons & deadlines", href: "/calendar", color: "text-averna-purple", bgColor: "bg-averna-purple/15" },
    { icon: Gift, label: "Rewards Store", description: "Spend your points", href: "/rewards", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
    { icon: MessageSquare, label: "Messages", description: "Chat with your teacher", href: "/messages", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
  ];

  const groups = [
    { title: "Practice", icon: GraduationCap, accent: "text-averna-cyan", items: practice },
    { title: "Play & Compete", icon: Gamepad2, accent: "text-averna-pink", items: compete },
    { title: "Tools & More", icon: Wrench, accent: "text-averna-purple", items: tools },
  ];

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="h-5 w-5 text-averna-neon" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.title}>
              <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${group.accent} mb-3`}>
                <GroupIcon className="h-3.5 w-3.5" /> {group.title}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group relative flex items-center gap-3 p-3 rounded-xl bg-averna-dark/30 border border-white/5 hover:border-averna-neon/30 hover:bg-averna-dark/50 hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bgColor} ${action.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
                          {action.label}
                          {action.live && (
                            <span className="text-[9px] font-bold bg-averna-neon text-averna-dark px-1.5 py-0.5 rounded-full animate-pulse">
                              LIVE
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-600 shrink-0 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
