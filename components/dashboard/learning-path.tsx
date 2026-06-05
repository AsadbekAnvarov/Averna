"use client";

import { useState, useEffect } from "react";
import {
  Rocket,
  CheckCircle2,
  ChevronRight,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Trophy,
  Sparkles,
  Star,
  Zap,
  Target,
  GraduationCap,
  ArrowRight,
  Flame,
  AudioLines,
} from "lucide-react";
import Link from "next/link";

type Difficulty = "Easy" | "Medium" | "Hard";

interface LearningPathProps {
  studentName: string | null;
  currentStreak: number;
  xpEarnedToday: number;
  hasListening: boolean;
  hasReading: boolean;
  hasWriting: boolean;
  hasSpeaking: boolean;
  hasMockExam: boolean;
  hasHomework: boolean;
  hasFlashcards: boolean;
  hasChallenge: boolean;
  hasPronunciation: boolean;
}

interface PathStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  glowColor: string;
  bgColor: string;
  borderColor: string;
  isCompleted: boolean;
  xp: number;
  difficulty: Difficulty;
}

const DAILY_GOAL_XP = 100;

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Hard: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function LearningPath({
  studentName,
  currentStreak,
  xpEarnedToday,
  hasListening,
  hasReading,
  hasWriting,
  hasSpeaking,
  hasMockExam,
  hasHomework,
  hasFlashcards,
  hasChallenge,
  hasPronunciation,
}: LearningPathProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [animateActive, setAnimateActive] = useState(false);

  const steps: PathStep[] = [
    {
      id: "listening",
      title: "Listening Practice",
      description: "Train your ear to understand natural English.",
      icon: Headphones,
      href: "/learning/listening",
      color: "text-emerald-400",
      glowColor: "shadow-[0_0_20px_rgba(52,211,153,0.3)]",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/40",
      isCompleted: hasListening,
      xp: 15,
      difficulty: "Medium",
    },
    {
      id: "reading",
      title: "Reading Exercise",
      description: "Read a passage and answer the questions.",
      icon: BookOpen,
      href: "/learning/reading",
      color: "text-blue-400",
      glowColor: "shadow-[0_0_20px_rgba(96,165,250,0.3)]",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/40",
      isCompleted: hasReading,
      xp: 15,
      difficulty: "Medium",
    },
    {
      id: "writing",
      title: "Writing Task",
      description: "Write a short essay and get instant AI feedback.",
      icon: PenTool,
      href: "/learning/writing",
      color: "text-purple-400",
      glowColor: "shadow-[0_0_20px_rgba(192,132,252,0.3)]",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/40",
      isCompleted: hasWriting,
      xp: 20,
      difficulty: "Hard",
    },
    {
      id: "vocabulary",
      title: "Learn Vocabulary",
      description: "Study flashcards to grow your word bank.",
      icon: Zap,
      href: "/flashcards",
      color: "text-averna-purple",
      glowColor: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
      bgColor: "bg-averna-purple/10",
      borderColor: "border-averna-purple/40",
      isCompleted: hasFlashcards,
      xp: 10,
      difficulty: "Easy",
    },
    {
      id: "pronunciation",
      title: "Pronunciation Coach",
      description: "Say phrases aloud and get a clarity score.",
      icon: AudioLines,
      href: "/learning/pronunciation",
      color: "text-averna-pink",
      glowColor: "shadow-[0_0_20px_rgba(236,72,153,0.3)]",
      bgColor: "bg-averna-pink/10",
      borderColor: "border-averna-pink/40",
      isCompleted: hasPronunciation,
      xp: 10,
      difficulty: "Easy",
    },
    {
      id: "speaking",
      title: "Speaking Practice",
      description: "Talk to the AI examiner or a live partner.",
      icon: Mic,
      href: "/learning/speaking",
      color: "text-orange-400",
      glowColor: "shadow-[0_0_20px_rgba(251,146,60,0.3)]",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/40",
      isCompleted: hasSpeaking,
      xp: 20,
      difficulty: "Hard",
    },
    {
      id: "challenge",
      title: "Daily Challenge",
      description: "A quick quiz to keep your streak alive.",
      icon: Flame,
      href: "/challenge",
      color: "text-averna-cyan",
      glowColor: "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
      bgColor: "bg-averna-cyan/10",
      borderColor: "border-averna-cyan/40",
      isCompleted: hasChallenge,
      xp: 10,
      difficulty: "Easy",
    },
    {
      id: "homework",
      title: "Submit Homework",
      description: "Check and submit homework from your teacher.",
      icon: Target,
      href: "/homework",
      color: "text-averna-pink",
      glowColor: "shadow-[0_0_20px_rgba(236,72,153,0.3)]",
      bgColor: "bg-averna-pink/10",
      borderColor: "border-averna-pink/40",
      isCompleted: hasHomework,
      xp: 15,
      difficulty: "Medium",
    },
    {
      id: "mock",
      title: "Mock Exam",
      description: "Take a full mini-IELTS test to measure your level.",
      icon: GraduationCap,
      href: "/learning/mock-exam",
      color: "text-yellow-400",
      glowColor: "shadow-[0_0_20px_rgba(250,204,21,0.3)]",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/40",
      isCompleted: hasMockExam,
      xp: 30,
      difficulty: "Hard",
    },
  ];

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const allCompleted = completedCount === steps.length;
  // The active step is the first one that isn't done yet.
  const activeIndex = steps.findIndex((s) => !s.isCompleted);

  const goalPercent = Math.min(100, Math.round((xpEarnedToday / DAILY_GOAL_XP) * 100));
  const goalReached = xpEarnedToday >= DAILY_GOAL_XP;
  const firstName = studentName?.split(" ")[0] ?? "learner";

  useEffect(() => {
    const timer = setTimeout(() => setAnimateActive(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl glass-strong border border-averna-cyan/30 animate-fade-in">
      {/* Background glow accents */}
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-averna-cyan/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-averna-purple/10 blur-3xl" />

      {/* Header */}
      <div className="relative p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Title block */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-averna-cyan via-averna-neon to-averna-purple flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.4)]">
                <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              {!allCompleted && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-averna-neon animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">
                {allCompleted ? (
                  <>Amazing work, {firstName}! 🎉</>
                ) : (
                  <>Your Daily Plan</>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                {allCompleted
                  ? "Every step done. Come back tomorrow to keep growing!"
                  : "Follow the plan step by step — small wins add up fast."}
              </p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-averna-neon/15 border border-averna-neon/30 text-averna-neon text-xs font-semibold">
              <Star className="h-3.5 w-3.5" />
              {xpEarnedToday} XP today
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5" />
              {currentStreak}-day streak
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "Hide" : "Show"}
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        {/* Daily XP goal meter */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-averna-cyan" />
              Daily goal
            </span>
            <span className={`text-xs font-bold ${goalReached ? "text-averna-neon" : "text-averna-cyan"}`}>
              {goalReached ? "Goal reached! 🎯" : `${xpEarnedToday} / ${DAILY_GOAL_XP} XP`}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-neon via-averna-cyan to-averna-purple transition-all duration-1000 ease-out relative"
              style={{ width: `${goalPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Steps progress */}
          <div className="flex items-center justify-between mt-3 mb-1.5">
            <span className="text-xs font-medium text-gray-400">
              Tasks completed: {completedCount}/{steps.length}
            </span>
            <span className="text-xs font-bold text-averna-purple">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-pink transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps list */}
      {isExpanded && (
        <div className="relative px-3 sm:px-6 pb-5 sm:pb-6">
          <div className="space-y-2.5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeIndex;

              if (step.isCompleted) {
                // Completed — compact, satisfying done row
                return (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl bg-averna-neon/5 border border-averna-neon/20"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-averna-neon/20 border-2 border-averna-neon flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-averna-neon" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium text-averna-neon/80 line-through truncate">
                      {step.title}
                    </p>
                    <span className="text-xs text-averna-neon/70 font-semibold shrink-0">
                      +{step.xp} XP ✓
                    </span>
                  </div>
                );
              }

              if (isActive) {
                // Active — the highlighted "do this now" call to action
                return (
                  <Link
                    key={step.id}
                    href={step.href}
                    className={`group block p-3.5 sm:p-4 rounded-xl border-2 ${step.borderColor} ${step.bgColor} ${step.glowColor} hover:scale-[1.01] transition-all duration-300`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="relative shrink-0">
                        <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl ${step.bgColor} border-2 ${step.borderColor} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${step.color}`} />
                        </div>
                        {animateActive && (
                          <div className={`absolute inset-0 rounded-xl border-2 ${step.borderColor} animate-ping opacity-30`} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm sm:text-base font-bold ${step.color}`}>
                            {step.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded-full bg-averna-neon/20 text-averna-neon text-[9px] font-bold uppercase tracking-wide animate-pulse">
                            Start here
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${DIFFICULTY_STYLES[step.difficulty]}`}>
                            {step.difficulty}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 mt-0.5 line-clamp-2">
                          {step.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs font-bold text-averna-neon whitespace-nowrap">+{step.xp} XP</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-300 group-hover:text-white">
                          Go
                          <ArrowRight className={`h-4 w-4 ${step.color} group-hover:translate-x-1 transition-transform`} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              }

              // Upcoming — dimmed but still tappable so motivated students can jump ahead
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <div className="h-9 w-9 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-300 truncate">{step.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{step.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[11px] text-gray-400 font-semibold">+{step.xp} XP</span>
                    <span className={`px-1.5 py-0.5 rounded-full border text-[8px] font-bold ${DIFFICULTY_STYLES[step.difficulty]}`}>
                      {step.difficulty}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer message */}
          {!allCompleted ? (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-averna-purple/10 to-averna-cyan/10 border border-averna-purple/20">
              <Sparkles className="h-5 w-5 text-averna-purple shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300">
                <span className="font-semibold text-averna-cyan">Tip:</span>{" "}
                Do a little every day. Each small task earns XP and builds the habit that makes you improve fastest. 🚀
              </p>
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-averna-neon/10 via-averna-cyan/10 to-averna-purple/10 border border-averna-neon/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <Star className="h-5 w-5 text-yellow-400" />
                <Trophy className="h-6 w-6 text-averna-neon" />
                <Star className="h-5 w-5 text-yellow-400" />
              </div>
              <p className="text-sm font-bold text-averna-neon">All tasks done for today! 🏆</p>
              <p className="text-xs text-gray-400 mt-1">
                Come back tomorrow — your plan resets and your streak keeps growing.
              </p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
