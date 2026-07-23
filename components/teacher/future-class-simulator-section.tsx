import { getGroupsBrief } from "@/lib/teacher-intel";
import { FutureClassSimulator } from "@/components/teacher/future-class-simulator";

/** Server wrapper: loads the teacher's groups (level, size, avg band, weakest skill). */
export async function FutureClassSimulatorSection({ teacherId }: { teacherId: string }) {
  const groups = await getGroupsBrief(teacherId);
  return <FutureClassSimulator groups={groups} />;
}
