import { buildSessionOutcome } from "@/lib/engine/progression/service";
import { NextStepCard } from "@/components/learning/next-step-card";
import { SessionOutcomeCard } from "./session-outcome";

/**
 * Server wrapper for result pages: builds the session outcome for a saved test
 * and falls back to the older NextStepCard when the outcome can't be built
 * (e.g. a legacy result).
 */
export async function SessionOutcomeSection({
  studentId,
  testId,
  label,
  score,
}: {
  studentId: string;
  testId: string;
  label: string;
  score: number;
}) {
  const outcome = await buildSessionOutcome(studentId, testId);
  if (!outcome) return <NextStepCard studentId={studentId} completedLabel={label} completedScore={score} />;
  return <SessionOutcomeCard outcome={outcome} />;
}
