import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, BookOpen, Headphones, Mic, Trophy, MessageSquare, Zap, Layers, UserCheck, CalendarClock, Gift, CalendarDays, Crown } from "lucide-react";
import Link from "next/link";
import { isSpeakingTime, getTimeUntilSpeakingTime } from "@/lib/utils";

export function QuickActions() {
  const speakingTimeActive = isSpeakingTime();
  const speakingTimeText = getTimeUntilSpeakingTime();

  const actions = [
    {
      icon: PenTool,
      label: "Writing",
      description: "Practice Task 1 & 2",
      href: "/learning/writing",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      available: true,
    },
    {
      icon: BookOpen,
      label: "Reading",
      description: "Take a reading test",
      href: "/learning/reading",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      available: true,
    },
    {
      icon: Headphones,
      label: "Listening",
      description: "Practice listening",
      href: "/learning/listening",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      available: true,
    },
    {
      icon: Mic,
      label: "Speaking",
      description: speakingTimeText,
      href: "/learning/speaking",
      color: speakingTimeActive ? "text-averna-neon" : "text-orange-400",
      bgColor: speakingTimeActive ? "bg-averna-neon/10" : "bg-orange-500/10",
      available: true,
      badge: speakingTimeActive ? "LIVE NOW" : undefined,
    },
    {
      icon: Trophy,
      label: "Rankings",
      description: "View leaderboards",
      href: "/rankings",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      available: true,
    },
    {
      icon: Crown,
      label: "Leagues",
      description: "Weekly season league",
      href: "/leagues",
      color: "text-averna-cyan",
      bgColor: "bg-averna-cyan/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: MessageSquare,
      label: "AI Mentor",
      description: "Get instant help",
      href: "/mentor",
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      available: true,
    },
    {
      icon: Zap,
      label: "Daily Challenge",
      description: "Test yourself today",
      href: "/challenge",
      color: "text-averna-cyan",
      bgColor: "bg-averna-cyan/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: Mic,
      label: "Pronunciation Coach",
      description: "Speak & get scored",
      href: "/learning/pronunciation",
      color: "text-averna-pink",
      bgColor: "bg-averna-pink/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: Layers,
      label: "Flashcards",
      description: "Master vocabulary",
      href: "/flashcards",
      color: "text-averna-purple",
      bgColor: "bg-averna-purple/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: UserCheck,
      label: "Second Teacher",
      description: "Book 1-on-1 practice",
      href: "/tutoring",
      color: "text-averna-pink",
      bgColor: "bg-averna-pink/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: CalendarClock,
      label: "My Schedule",
      description: "Lessons & attendance",
      href: "/schedule",
      color: "text-averna-cyan",
      bgColor: "bg-averna-cyan/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: Gift,
      label: "Rewards Store",
      description: "Spend your points",
      href: "/rewards",
      color: "text-averna-pink",
      bgColor: "bg-averna-pink/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: MessageSquare,
      label: "Messages",
      description: "Chat with your teacher",
      href: "/messages",
      color: "text-averna-cyan",
      bgColor: "bg-averna-cyan/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: CalendarDays,
      label: "Calendar",
      description: "Lessons & deadlines",
      href: "/calendar",
      color: "text-averna-purple",
      bgColor: "bg-averna-purple/10",
      available: true,
      badge: "NEW",
    },
    {
      icon: Trophy,
      label: "Mock Exam",
      description: "Timed mini IELTS test",
      href: "/learning/mock-exam",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      available: true,
      badge: "NEW",
    },
  ];

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Jump into your learning modules</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={`relative p-4 rounded-lg ${action.bgColor} border border-transparent hover:border-averna-neon/30 transition-all duration-300 hover:scale-105 group`}
              >
                {action.badge && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      {action.badge}
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={`${action.color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className={`font-semibold ${action.color} text-sm`}>
                      {action.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
