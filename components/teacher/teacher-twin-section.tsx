import { getTeacherFeedbackProfile } from "@/lib/teacher-intel";
import { TeacherTwin } from "@/components/teacher/teacher-twin";

/** Server wrapper: loads how much feedback the Twin has learned from. */
export async function TeacherTwinSection({ teacherId }: { teacherId: string }) {
  const profile = await getTeacherFeedbackProfile(teacherId);
  return <TeacherTwin learned={profile.count} avgLen={profile.avgLen} />;
}
