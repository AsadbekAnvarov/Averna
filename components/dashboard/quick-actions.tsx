import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mic, Trophy, MessageSquare, Zap, Layers,
  UserCheck, CalendarClock, Gift, Crown, Swords, Library, Bot,
  GraduationCap, Gamepad2, Wrench, Award, SpellCheck,
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

  // Counts are kept as multiples of the column grid (8 / 4 / 8) so every row is
  // perfectly filled at both 2 and 4 columns — no lonely trailing tiles.
  // Core skills (Reading/Listening/Writing/Speaking) live in the Living Campus,
  // so Practice here holds the complementary tools only — no duplicate nav.
  const practice: Action[] = [
    { icon: Mic, label: "Pronunciation", description: "Speak & get scored", href: "/learning/pronunciation", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
    { icon: Bot, label: "AI Examiner", description: speakingTimeActive ? speakingTimeText : "Speak, get a band", href: "/learning/examiner", color: speakingTimeActive ? "text-averna-neon" : "text-averna-cyan", bgColor: speakingTimeActive ? "bg-averna-neon/15" : "bg-averna-cyan/15", live: speakingTimeActive },
    { icon: SpellCheck, label: "Grammar", description: "Rules & practice", href: "/grammar", color: "text-teal-400", bgColor: "bg-teal-500/15" },
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
    { icon: Award, label: "Achievements", description: "Badges & milestones", href: "/achievements", color: "text-amber-400", bgColor: "bg-amber-500/15" },
    { icon: UserCheck, label: "Second Teacher", description: "Book 1-on-1 practice", href: "/tutoring", color: "text-averna-pink", bgColor: "bg-averna-pink/15" },
    { icon: CalendarClock, label: "My Schedule", description: "Lessons & attendance", href: "/schedule", color: "text-averna-cyan", bgColor: "bg-averna-cyan/15" },
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
          <Zap className="h-5 w-5 text-averna-neon" /> Quick Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.title}>
              <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${group.accent} mb-3`}>
                <GroupIcon className="h-3.5 w-3.5" /> {group.title}
                <span className="ml-auto text-gray-600 normal-case font-normal">{group.items.length}</span>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {group.items.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group relative flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl bg-averna-dark/30 border border-white/5 hover:border-averna-neon/40 hover:bg-averna-dark/60 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,229,255,0.35)]"
                    >
                      {action.live && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-averna-neon text-averna-dark px-1.5 py-0.5 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.bgColor} ${action.color} transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="font-semibold text-white text-sm truncate">{action.label}</p>
                        <p className="text-[11px] text-gray-400 truncate">{action.description}</p>
                      </div>
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
