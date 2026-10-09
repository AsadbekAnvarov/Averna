import { getExamReadiness } from "@/lib/student-intel";
import { PracticeReadiness } from "./practice-readiness";
/** Kept at the existing entry point; no digital-twin or future-score claim. */
export async function AiClone({ studentId }: { studentId: string }) {
  return <PracticeReadiness summary={await getExamReadiness(studentId)} />;
}
