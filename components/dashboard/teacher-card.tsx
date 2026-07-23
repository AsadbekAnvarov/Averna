import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, CalendarClock, GraduationCap } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { parseSchedule, tashkentWeekday, WEEKDAY_NAMES, initialsOf } from "@/lib/utils";

/**
 * Teacher card — puts a friendly face on the class: who teaches it, the next
 * lesson (parsed from the group schedule) and a one-tap "message teacher".
 */
export async function TeacherCard({ groupId }: { groupId: string | null }) {
  if (!groupId) return null;

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      name: true,
      schedule: true,
      teacher: { select: { specialty: true, ieltsBand: true, user: { select: { id: true, name: true, image: true } } } },
    },
  });
  if (!group) return null;

  const teacher = group.teacher;
  const { days, time } = parseSchedule(group.schedule);
  const todayIdx = tashkentWeekday();
  let nextLabel: string | null = null;
  if (days.length > 0) {
    const offsets = days.map((d) => (d - todayIdx + 7) % 7).sort((a, b) => a - b);
    const off = offsets[0];
    const wd = off === 0 ? "Today" : off === 1 ? "Tomorrow" : WEEKDAY_NAMES[(todayIdx + off) % 7];
    nextLabel = time ? `${wd} · ${time}` : wd;
  }

  const initials = initialsOf(teacher.user.name);

  return (
    <Card className="glass border-averna-cyan/30">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-averna-cyan/15 text-averna-cyan font-bold text-lg overflow-hidden shrink-0">
            {teacher.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teacher.user.image} alt={teacher.user.name ?? "Teacher"} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" /> Your teacher
            </p>
            <p className="font-bold text-white truncate flex items-center gap-2">
              <span className="truncate">{teacher.user.name ?? "Teacher"}</span>
              {teacher.ieltsBand != null && (
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-averna-neon/15 text-averna-neon border border-averna-neon/40">
                  IELTS {teacher.ieltsBand}
                </span>
              )}
            </p>
            {teacher.specialty && <p className="text-xs text-averna-cyan truncate">{teacher.specialty}</p>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1.5 min-w-0">
            <CalendarClock className="h-4 w-4 text-averna-cyan shrink-0" />
            <span className="truncate">{nextLabel ? `Next: ${nextLabel}` : group.name}</span>
          </span>
          <Link
            href={`/messages?with=${teacher.user.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors shrink-0"
          >
            <MessageSquare className="h-4 w-4" /> Message
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
