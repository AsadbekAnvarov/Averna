import { getGraduation } from "@/lib/student-intel";
import { GraduationCeremony } from "@/components/dashboard/graduation-ceremony";

/** Server wrapper: computes graduation status + stats from real data. */
export async function GraduationSection({
  studentId,
  targetBand,
  firstName,
}: {
  studentId: string;
  targetBand?: string | null;
  firstName: string;
}) {
  const g = await getGraduation(studentId, targetBand);
  return <GraduationCeremony {...g} firstName={firstName} />;
}
