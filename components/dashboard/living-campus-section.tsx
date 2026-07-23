import { getGalaxy } from "@/lib/student-intel";
import { LivingCampus } from "@/components/dashboard/living-campus";

/** Server wrapper: loads real per-skill mastery for the campus locations. */
export async function LivingCampusSection({ studentId }: { studentId: string }) {
  const planets = await getGalaxy(studentId);
  return <LivingCampus planets={planets} />;
}
