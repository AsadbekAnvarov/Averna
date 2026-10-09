import { getExamReadiness } from "@/lib/student-intel";
import { PracticeReadiness } from "./practice-readiness";
/** Same evidence policy as readiness; mixed-module history cannot predict an overall band. */
export async function BandProgress({ studentId, targetBand }: { studentId: string; targetBand?: string | null }) {
  return <PracticeReadiness summary={await getExamReadiness(studentId)} targetBand={targetBand} />;
}
