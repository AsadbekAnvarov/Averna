import Link from "next/link";
import { db } from "@/lib/db";
import { isSpeakingTime } from "@/lib/utils";
import { AlertTriangle, BookOpen, MessageSquare, Mic, Zap, Sparkles } from "lucide-react";

/**
 * Student "focus for today" bar — a friendly, scannable row of what to do next:
 * overdue homework, homework due, unread messages, live Speaking Time, and a
 * nudge to the daily challenge. Mirrors the teacher/admin attention bars for a
 * consistent feel.
 */
export async function StudentAttentionBar({
  userId,
  homeworkDue,
  homeworkOverdue,
}: {
  userId: string;
  homeworkDue: number;
  homeworkOverdue: number;
}) {
  const unread = await db.message.count({ where: { receiverId: userId, read: false } });
  const speaking = isSpeakingTime();

  const chips = [
    homeworkOverdue > 0 && {
      href: "/homework",
      icon: AlertTriangle,
      label: `${homeworkOverdue} overdue`,
      cls: "border-red-400/40 bg-red-500/10 text-red-300 hover:border-red-400/70",
    },
    homeworkDue > 0 && {
      href: "/homework",
      icon: BookOpen,
      label: `${homeworkDue} homework due`,
      cls: "border-averna-purple/30 bg-averna-purple/10 text-averna-purple hover:border-averna-purple/60",
    },
    unread > 0 && {
      href: "/messages",
      icon: MessageSquare,
      label: `${unread} new message${unread === 1 ? "" : "s"}`,
      cls: "border-averna-cyan/30 bg-averna-cyan/10 text-averna-cyan hover:border-averna-cyan/60",
    },
    speaking && {
      href: "/learning/speaking",
      icon: Mic,
      label: "Speaking Time is live",
      cls: "border-averna-pink/30 bg-averna-pink/10 text-averna-pink hover:border-averna-pink/60",
    },
    {
      href: "/challenge",
      icon: Zap,
      label: "Daily challenge",
      cls: "border-averna-neon/30 bg-averna-neon/10 text-averna-neon hover:border-averna-neon/60",
    },
  ].filter(Boolean) as { href: string; icon: any; label: string; cls: string }[];

  return (
    <nav
      aria-label="Focus today"
      // Keep every action visible on phones instead of fading/clipping the last chip.
      className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5"
    >
      <span className="w-full shrink-0 text-xs sm:w-auto sm:text-sm text-gray-400 font-medium flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-averna-neon" aria-hidden /> Focus today:
      </span>
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.label}
            href={c.href}
            className={`inline-flex min-h-11 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] sm:text-sm font-medium transition-colors ${c.cls}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
