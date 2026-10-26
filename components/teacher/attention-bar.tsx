import Link from "next/link";
import { db } from "@/lib/db";
import { CheckSquare, MessageSquare, CheckCircle2 } from "lucide-react";

/**
 * "What needs your attention today" — a compact row of work counts at the very
 * top of the teacher dashboard (homework to grade, unread messages). Each chip
 * deep-links to where the work happens. The per-student "at risk" chip it used
 * to carry became the "Who needs help today" list right below it (idea 10),
 * which names each student and why.
 */
export async function TeacherAttentionBar({ teacherId, userId }: { teacherId: string; userId: string }) {
  const [toGrade, unread] = await Promise.all([
    // Classic homework only: exam homework waiting for a teacher is counted by the review queue card.
    db.homeworkSubmission.count({ where: { status: "SUBMITTED", homework: { teacherId, contentKind: null } } }),
    db.message.count({ where: { receiverId: userId, read: false } }),
  ]);

  const chips = [
    toGrade > 0 && {
      href: "/teacher/homework",
      icon: CheckSquare,
      label: `${toGrade} to grade`,
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:border-amber-400/60",
    },
    unread > 0 && {
      href: "/messages",
      icon: MessageSquare,
      label: `${unread} new message${unread === 1 ? "" : "s"}`,
      cls: "border-averna-cyan/30 bg-averna-cyan/10 text-averna-cyan hover:border-averna-cyan/60",
    },
  ].filter(Boolean) as { href: string; icon: typeof CheckSquare; label: string; cls: string }[];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-sm text-gray-400 font-medium">Needs attention:</span>
      {chips.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/10 text-averna-neon text-sm">
          <CheckCircle2 className="h-4 w-4" /> Nothing to grade or read
        </span>
      ) : (
        chips.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors lg:min-h-0 ${c.cls}`}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </Link>
          );
        })
      )}
    </div>
  );
}
