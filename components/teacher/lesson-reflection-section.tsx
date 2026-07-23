import { getRecentLessons, getGroupsBrief } from "@/lib/teacher-intel";
import { LessonReflection } from "@/components/teacher/lesson-reflection";

/** Server wrapper: loads recent lessons and tags each with the group's weakest skill. */
export async function LessonReflectionSection({ teacherId }: { teacherId: string }) {
  const [lessons, groups] = await Promise.all([getRecentLessons(teacherId), getGroupsBrief(teacherId)]);
  const weakByGroup = new Map(groups.map((g) => [g.name, g.weakModule]));
  const enriched = lessons.map((l) => ({ ...l, weakArea: weakByGroup.get(l.group) ?? null }));
  return <LessonReflection lessons={enriched} />;
}
