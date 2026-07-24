import { getStudentTests } from "@/lib/student-intel";
import { predictBand } from "@/lib/utils";
import { FutureSelf } from "@/components/dashboard/future-self";

/** Server wrapper: computes the student's current band and hands it to the animated view. */
export async function FutureSelfSection({
  studentId,
  targetBand,
  points,
  streak,
}: {
  studentId: string;
  targetBand?: string | null;
  points: number;
  streak: number;
}) {
  const tests = await getStudentTests(studentId);
  const scores = tests.map((t) => t.score).filter((s) => s > 0);
  const p = predictBand(scores);
  const current = p ? p.current : null;
  const target = targetBand ? parseFloat(targetBand.replace(/[^0-9.]/g, "")) || null : null;

  return <FutureSelf current={current} target={target} points={points} streak={streak} />;
}
