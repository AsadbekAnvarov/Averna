import { getExamReadiness } from "@/lib/student-intel";
import { AvernaAi } from "@/components/dashboard/averna-ai";

/** Server wrapper: computes a proactive opening suggestion from real data. */
export async function AvernaAiSection({ studentId, firstName }: { studentId: string; firstName: string }) {
  const r = await getExamReadiness(studentId);
  let greeting: string;
  if (r.overall == null) {
    greeting = `Hi ${firstName}! I'm Averna AI. We do not have enough complete evidence for an overall summary yet. I can help you choose your next practice step.`;
  } else if (r.weakest) {
    greeting = `Hi ${firstName}! Your recent four-skill practice summary is ${r.overall.toFixed(1)}, not a forecast. Your biggest opportunity right now is ${r.weakest.label} (Band ${r.weakest.current?.toFixed(1)}) — want a plan?`;
  } else {
    greeting = `Hi ${firstName}! Your recent four-skill practice summary is ${r.overall.toFixed(1)}, not a forecast. Ask me what to study, why you're stuck, or your fastest path to your goal.`;
  }
  return <AvernaAi greeting={greeting} />;
}
