import { placementPromptState } from "@/lib/placement/placement";
import { PlacementPromptCard } from "./placement-prompt-card";

/**
 * Dashboard prompt for students who have never finished a placement test.
 * Server component (reads the student's sittings); renders nothing once a
 * placement is finished, or when the data can't be read.
 */
export async function PlacementPrompt({ studentId }: { studentId: string }) {
  const state = await placementPromptState(studentId);
  if (!state.show) return null;
  return <PlacementPromptCard activeAttemptId={state.activeAttemptId} />;
}

export default PlacementPrompt;
