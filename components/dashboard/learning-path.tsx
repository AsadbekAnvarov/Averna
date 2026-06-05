"use client";

import { useState, useEffect } from "react";
import { 
  Rocket, 
  CheckCircle2, 
  Circle, 
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
  Lock,
  Flame
} from "lucide-react";
import Link from "next/link";

interface LearningPathProps {
  studentName: string | null;
  totalPoints: number;
  currentStreak: number;
  testsCompleted: number;
  hasListening: boolean;
  hasReading: boolean;
  hasWriting: boolean;
  hasSpeaking: boolean;
  hasMockExam: boolean;
  hasHomework: boolean;
  hasFlashcards: boolean;
  hasChallenge: boolean;
}

interface PathStep {
  id: string;
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  glowColor: string;
  bgColor: string;
  borderColor: string;
  isCompleted: boolean;
  isActive: boolean;
  reward: string;
}

export function LearningPath({
  studentName,
  totalPoints,
  currentStreak,
  testsCompleted,
  hasListening,
  hasReading,
  hasWriting,
  hasSpeaking,
  hasMockExam,
  hasHomework,
  hasFlashcards,
  hasChallenge,
}: LearningPathProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [animateStep, setAnimateStep] = useState<number | null>(null);

  // Define the learning path steps
  const steps: PathStep[] = [
    {
      id: "listening",
      number: 1,
      title: "Listening Practice",
      description: "Start with listening — train your ear to understand English naturally",
      icon: Headphones,
      href: "/learning/listening",
      color: "text-emerald-400",
      glowColor: "shadow-[0_0_20px_rgba(52,211,153,0.3)]",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/40",
      isCompleted: hasListening,
      isActive: !hasListening,
      reward: "+15 pts",
    },
    {
      id: "reading",
      number: 2,
      title: "Reading Exercise",
      description: "Read a passage and answer questions — build comprehension skills",
      icon: BookOpen,
      href: "/learning/reading",
      color: "text-blue-400",
      glowColor: "shadow-[0_0_20px_rgba(96,165,250,0.3)]",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/40",
      isCompleted: hasReading,
      isActive: hasListening && !hasReading,
      reward: "+15 pts",
    },
    {
      id: "writing",
      number: 3,
      title: "Writing Task",
      description: "Write your first essay — AI will give you instant feedback",
      icon: PenTool,
      href: "/learning/writing",
      color: "text-purple-400",
      glowColor: "shadow-[0_0_20px_rgba(192,132,252,0.3)]",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/40",
      isCompleted: hasWriting,
      isActive: hasListening && hasReading && !hasWriting,
      reward: "+20 pts",
    },
    {
      id: "vocabulary",
      number: 4,
      title: "Learn Vocabulary",
      description: "Study flashcards to expand your word bank for all sections",
      icon: Zap,
      href: "/flashcards",
      color: "text-averna-purple",
      glowColor: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
      bgColor: "bg-averna-purple/10",
      borderColor: "border-averna-purple/40",
      isCompleted: hasFlashcards,
      isActive: hasListening && hasReading && hasWriting && !hasFlashcards,
      reward: "+10 pts",
    },
    {
      id: "speaking",
      number: 5,
      title: "Speaking Practice",
      description: "Talk to our AI or find a partner — practice speaking confidently",
      icon: Mic,
      href: "/learning/speaking",
      color: "text-orange-400",
      glowColor: "shadow-[0_0_20px_rgba(251,146,60,0.3)]",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/40",
      isCompleted: hasSpeaking,
      isActive: hasListening && hasReading && hasWriting && hasFlashcards && !hasSpeaking,
      reward: "+20 pts",
    },
    {
      id: "challenge",
      number: 6,
      title: "Daily Challenge",
      description: "Complete a quick daily challenge to keep your streak alive",
      icon: Flame,
      href: "/challenge",
      color: "text-averna-cyan",
      glowColor: "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
      bgColor: "bg-averna-cyan/10",
      borderColor: "border-averna-cyan/40",
      isCompleted: hasChallenge,
      isActive: hasListening && hasReading && hasWriting && hasFlashcards && hasSpeaking && !hasChallenge,
      reward: "+25 pts",
    },
    {
      id: "homework",
      number: 7,
      title: "Submit Homework",
      description: "Check and submit any pending homework from your teacher",
      icon: Target,
      href: "/homework",
      color: "text-averna-pink",
      glowColor: "shadow-[0_0_20px_rgba(236,72,153,0.3)]",
      bgColor: "bg-averna-pink/10",
      borderColor: "border-averna-pink/40",
      isCompleted: hasHomework,
      isActive: hasListening && hasReading && hasWriting && hasFlashcards && hasSpeaking && hasChallenge && !hasHomework,
      reward: "+30 pts",
    },
    {
      id: "mock",
      number: 8,
      title: "Mock Exam",
      description: "Take a full mini-IELTS test to see your real level!",
      icon: GraduationCap,
      href: "/learning/mock-exam",
      color: "text-yellow-400",
      glowColor: "shadow-[0_0_20px_rgba(250,204,21,0.3)]",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/40",
      isCompleted: hasMockExam,
      isActive: hasListening && hasReading && hasWriting && hasFlashcards && hasSpeaking && hasChallenge && hasHomework && !hasMockExam,
      reward: "+50 pts",
    },
  ];

  const completedCount = steps.filter(s => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const allCompleted = completedCount === steps.length;

  // Find the current active step for highlighting
  const activeStepIndex = steps.findIndex(s => s.isActive);

  useEffect(() => {
    // Animate the active step on load
    if (activeStepIndex >= 0) {
      const timer = setTimeout(() => setAnimateStep(activeStepIndex), 500);
      return () => clearTimeout(timer);
    }
  }, [activeStepIndex]);

  return (
    <div className="relative overflow-hidden rounded-2xl glass-strong border border-averna-cyan/30 animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-averna-cyan/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-averna-purple/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-averna-neon/5 blur-3xl" />

      {/* Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-averna-cyan via-averna-neon to-averna-purple flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.4)]">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              {!allCompleted && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-averna-neon animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                {allCompleted ? (
                  <>🎉 Отлично, {studentName?.split(" ")[0] ?? "студент"}! Все шаги пройдены!</>
                ) : (
                  <>Твой план на сегодня</>
                )}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {allCompleted 
                  ? "Ты молодец! Продолжай в том же духе завтра"
                  : "Следуй плану шаг за шагом — так ты точно добьёшься результата"
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            {isExpanded ? "Свернуть" : "Развернуть"}
            <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">
              Прогресс: {completedCount} из {steps.length} шагов
            </span>
            <span className="text-xs font-bold text-averna-neon">
              {progressPercent}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-neon via-averna-cyan to-averna-purple transition-all duration-1000 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
            {/* Step markers */}
            {steps.map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/30"
                style={{ left: `${((i + 1) / steps.length) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Steps List */}
      {isExpanded && (
        <div className="relative px-6 pb-6">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLocked = !step.isCompleted && !step.isActive && index > 0 && !steps[index - 1]?.isCompleted;
              const showAnimation = animateStep === index;

              return (
                <div
                  key={step.id}
                  className={`relative group transition-all duration-500 ${
                    showAnimation ? "animate-pulse-once" : ""
                  }`}
                >
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className={`absolute left-6 top-[3.5rem] h-[calc(100%_-_1rem)] w-0.5 ${
                      step.isCompleted ? "bg-gradient-to-b from-averna-neon to-averna-cyan" : "bg-white/10"
                    }`} />
                  )}

                  {step.isCompleted ? (
                    // Completed step - compact view
                    <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-averna-neon/5 border border-averna-neon/20">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full bg-averna-neon/20 border-2 border-averna-neon flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-averna-neon" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-averna-neon line-through opacity-70">
                          {step.title}
                        </p>
                      </div>
                      <span className="text-xs text-averna-neon/70 font-medium shrink-0">
                        ✓ Готово
                      </span>
                    </div>
                  ) : step.isActive ? (
                    // Active step - highlighted
                    <Link
                      href={step.href}
                      className={`block p-4 rounded-xl border-2 ${step.borderColor} ${step.bgColor} ${step.glowColor} hover:scale-[1.02] transition-all duration-300 cursor-pointer`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className={`h-12 w-12 rounded-xl ${step.bgColor} border-2 ${step.borderColor} flex items-center justify-center`}>
                            <Icon className={`h-6 w-6 ${step.color}`} />
                          </div>
                          <span className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-averna-neon text-[10px] font-bold text-black flex items-center justify-center">
                            {step.number}
                          </span>
                          {/* Pulse ring */}
                          <div className={`absolute inset-0 rounded-xl border-2 ${step.borderColor} animate-ping opacity-30`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-base font-bold ${step.color}`}>
                              {step.title}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-averna-neon/20 text-averna-neon text-[10px] font-bold uppercase animate-pulse">
                              Сейчас
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {step.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-bold text-averna-neon">{step.reward}</span>
                          <ArrowRight className={`h-5 w-5 ${step.color} group-hover:translate-x-1 transition-transform`} />
                        </div>
                      </div>
                    </Link>
                  ) : (
                    // Locked/upcoming step
                    <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-50">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <span className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-white/10 text-[10px] font-medium text-gray-500 flex items-center justify-center">
                          {step.number}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-500">
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {step.description}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">{step.reward}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom motivational message */}
          {!allCompleted && (
            <div className="mt-5 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-averna-purple/10 to-averna-cyan/10 border border-averna-purple/20">
              <Sparkles className="h-5 w-5 text-averna-purple shrink-0" />
              <p className="text-xs text-gray-300">
                <span className="font-semibold text-averna-cyan">Совет:</span>{" "}
                Проходи шаги по порядку каждый день. Это создаёт привычку и ты будешь расти быстрее! 🚀
              </p>
            </div>
          )}

          {allCompleted && (
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-averna-neon/10 via-averna-cyan/10 to-averna-purple/10 border border-averna-neon/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <Trophy className="h-6 w-6 text-averna-neon" />
                <Star className="h-5 w-5 text-yellow-400" />
              </div>
              <p className="text-sm font-bold text-averna-neon">
                Все шаги на сегодня завершены! 🏆
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Возвращайся завтра — план обновится и ты продолжишь расти
              </p>
            </div>
          )}
        </div>
      )}

      {/* Shimmer animation keyframes - add via style tag */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes pulse-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-once {
          animation: pulse-once 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
}
