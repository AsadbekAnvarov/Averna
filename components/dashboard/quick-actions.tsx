import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PenTool,
  BookOpen,
  Headphones,
  Mic,
  Trophy,
  MessageSquare,
  Zap,
  Layers,
  UserCheck,
  CalendarClock,
  Gift,
  CalendarDays,
  Crown,
  Swords,
  Library,
  Bot,
  GraduationCap,
  Dumbbell,
  Compass,
  TrendingUp,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { isSpeakingTime, getTimeUntilSpeakingTime } from "@/lib/utils";

type ActionItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  ring: string;
  badge?: string;
  live?: boolean;
};

type ActionSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // text color for section header
  accentBg: string; // bg tint for the header icon
  items: ActionItem[];
};

export function QuickActions() {
  const speakingTimeActive = isSpeakingTime();
  const speakingTimeText = getTimeUntilSpeakingTime();

  const sections: ActionSection[] = [
    {
      id: "core-skills",
      title: "Core IELTS Skills",
      subtitle: "The four main sections — practice these daily",
      icon: GraduationCap,
      accent: "text-averna-neon",
      accentBg: "bg-averna-neon/10 border-averna-neon/30",
      items: [
        {
          icon: Headphones,
          label: "Listening",
          description: "Train your ear",
          href: "/learning/listening",
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
          ring: "hover:border-emerald-400/50 hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]",
        },
        {
          icon: BookOpen,
          label: "Reading",
          description: "Take a reading test",
          href: "/learning/reading",
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          ring: "hover:border-blue-400/50 hover:shadow-[0_0_18px_rgba(96,165,250,0.25)]",
        },
        {
          icon: PenTool,
          label: "Writing",
          description: "Practice Task 1 & 2",
          href: "/learning/writing",
          color: "text-purple-400",
          bgColor: "bg-purple-500/10",
          ring: "hover:border-purple-400/50 hover:shadow-[0_0_18px_rgba(192,132,252,0.25)]",
        },
        {
          icon: Mic,
          label: "Speaking",
          description: speakingTimeText,
          href: "/learning/speaking",
          color: speakingTimeActive ? "text-averna-neon" : "text-orange-400",
          bgColor: speakingTimeActive ? "bg-averna-neon/10" : "bg-orange-500/10",
          ring: speakingTimeActive
            ? "hover:border-averna-neon/50 hover:shadow-[0_0_18px_rgba(0,255,148,0.3)]"
            : "hover:border-orange-400/50 hover:shadow-[0_0_18px_rgba(251,146,60,0.25)]",
          badge: speakingTimeActive ? "LIVE NOW" : undefined,
          live: speakingTimeActive,
        },
      ],
    },
    {
      id: "practice",
      title: "Practice & Tests",
      subtitle: "Sharpen your skills and check your level",
      icon: Dumbbell,
      accent: "text-averna-cyan",
      accentBg: "bg-averna-cyan/10 border-averna-cyan/30",
      items: [
        {
          icon: Trophy,
          label: "Mock Exam",
          description: "Timed mini IELTS test",
          href: "/learning/mock-exam",
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          ring: "hover:border-yellow-400/50 hover:shadow-[0_0_18px_rgba(250,204,21,0.25)]",
        },
        {
          icon: Bot,
          label: "AI Examiner",
          description: "Speak, get a band",
          href: "/learning/examiner",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: Mic,
          label: "Pronunciation",
          description: "Speak & get scored",
          href: "/learning/pronunciation",
          color: "text-averna-pink",
          bgColor: "bg-averna-pink/10",
          ring: "hover:border-averna-pink/50 hover:shadow-[0_0_18px_rgba(236,72,153,0.25)]",
        },
      ],
    },
    {
      id: "track-focus",
      title: "Track & Focus",
      subtitle: "Watch your growth and study with focus",
      icon: TrendingUp,
      accent: "text-averna-purple",
      accentBg: "bg-averna-purple/10 border-averna-purple/30",
      items: [
        {
          icon: TrendingUp,
          label: "My Progress",
          description: "Band trend & stats",
          href: "/progress",
          color: "text-averna-neon",
          bgColor: "bg-averna-neon/10",
          ring: "hover:border-averna-neon/50 hover:shadow-[0_0_18px_rgba(0,255,148,0.25)]",
        },
        {
          icon: Timer,
          label: "Focus Mode",
          description: "Pomodoro study timer",
          href: "/focus",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: Layers,
          label: "Flashcards",
          description: "Master vocabulary",
          href: "/flashcards",
          color: "text-averna-purple",
          bgColor: "bg-averna-purple/10",
          ring: "hover:border-averna-purple/50 hover:shadow-[0_0_18px_rgba(168,85,247,0.25)]",
        },
        {
          icon: Zap,
          label: "Daily Challenge",
          description: "Test yourself today",
          href: "/challenge",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
      ],
    },
    {
      id: "study",
      title: "Study & Resources",
      subtitle: "Build vocabulary and get guidance",
      icon: Library,
      accent: "text-averna-pink",
      accentBg: "bg-averna-pink/10 border-averna-pink/30",
      items: [
        {
          icon: Library,
          label: "Materials",
          description: "IELTS guides & lists",
          href: "/materials",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: MessageSquare,
          label: "AI Mentor",
          description: "Get instant help",
          href: "/mentor",
          color: "text-pink-400",
          bgColor: "bg-pink-500/10",
          ring: "hover:border-pink-400/50 hover:shadow-[0_0_18px_rgba(244,114,182,0.25)]",
        },
        {
          icon: UserCheck,
          label: "Second Teacher",
          description: "Book 1-on-1 practice",
          href: "/tutoring",
          color: "text-averna-pink",
          bgColor: "bg-averna-pink/10",
          ring: "hover:border-averna-pink/50 hover:shadow-[0_0_18px_rgba(236,72,153,0.25)]",
        },
      ],
    },
    {
      id: "compete",
      title: "Compete & Climb",
      subtitle: "Rise through the ranks and beat your friends",
      icon: Trophy,
      accent: "text-yellow-400",
      accentBg: "bg-yellow-500/10 border-yellow-500/30",
      items: [
        {
          icon: Trophy,
          label: "Rankings",
          description: "View leaderboards",
          href: "/rankings",
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          ring: "hover:border-yellow-400/50 hover:shadow-[0_0_18px_rgba(250,204,21,0.25)]",
        },
        {
          icon: Crown,
          label: "Leagues",
          description: "Weekly season league",
          href: "/leagues",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: Swords,
          label: "Team Challenge",
          description: "Group vs group race",
          href: "/team-challenge",
          color: "text-averna-pink",
          bgColor: "bg-averna-pink/10",
          ring: "hover:border-averna-pink/50 hover:shadow-[0_0_18px_rgba(236,72,153,0.25)]",
        },
      ],
    },
    {
      id: "organize",
      title: "Organize & Rewards",
      subtitle: "Stay on track and spend your points",
      icon: Compass,
      accent: "text-averna-purple",
      accentBg: "bg-averna-purple/10 border-averna-purple/30",
      items: [
        {
          icon: CalendarClock,
          label: "My Schedule",
          description: "Lessons & attendance",
          href: "/schedule",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: CalendarDays,
          label: "Calendar",
          description: "Lessons & deadlines",
          href: "/calendar",
          color: "text-averna-purple",
          bgColor: "bg-averna-purple/10",
          ring: "hover:border-averna-purple/50 hover:shadow-[0_0_18px_rgba(168,85,247,0.25)]",
        },
        {
          icon: MessageSquare,
          label: "Messages",
          description: "Chat with your teacher",
          href: "/messages",
          color: "text-averna-cyan",
          bgColor: "bg-averna-cyan/10",
          ring: "hover:border-averna-cyan/50 hover:shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        },
        {
          icon: Gift,
          label: "Rewards Store",
          description: "Spend your points",
          href: "/rewards",
          color: "text-averna-pink",
          bgColor: "bg-averna-pink/10",
          ring: "hover:border-averna-pink/50 hover:shadow-[0_0_18px_rgba(236,72,153,0.25)]",
        },
      ],
    },
  ];

  // Grid that always fills its rows: 4-item sections use a 2/4 column grid,
  // the 3-item section uses a 1/3 column grid. No lonely trailing cards.
  const gridFor = (count: number) =>
    count === 3
      ? "grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      : "grid grid-cols-2 lg:grid-cols-4 gap-2.5";

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-averna-neon/15 border border-averna-neon/30">
            <Zap className="h-4 w-4 text-averna-neon" />
          </span>
          Quick Actions
        </CardTitle>
        <CardDescription>Everything you need, neatly organized by category</CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${section.accentBg}`}
                >
                  <SectionIcon className={`h-5 w-5 ${section.accent}`} />
                </span>
                <div className="min-w-0">
                  <h3 className={`text-sm font-bold ${section.accent} leading-tight`}>
                    {section.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{section.subtitle}</p>
                </div>
                {/* divider line */}
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
              </div>

              {/* Section items */}
              <div className={gridFor(section.items.length)}>
                {section.items.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className={`group relative flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all duration-300 hover:-translate-y-0.5 ${action.ring}`}
                    >
                      {/* Badge */}
                      {action.badge && (
                        <span
                          className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            action.live
                              ? "bg-averna-neon text-black animate-pulse"
                              : "bg-averna-pink/90 text-white"
                          }`}
                        >
                          {action.badge}
                        </span>
                      )}

                      {/* Uniform icon container */}
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bgColor} border border-white/5 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <Icon className={`h-5 w-5 ${action.color}`} />
                      </span>

                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${action.color} leading-tight truncate`}>
                          {action.label}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {action.description}
                        </p>
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
