import { getExamReadiness } from "@/lib/student-intel";
import { AvernaAi } from "@/components/dashboard/averna-ai";

/** Server wrapper: computes a proactive opening suggestion from real data. */
export async function AvernaAiSection({ studentId, firstName }: { studentId: string; firstName: string }) {
  const r = await getExamReadiness(studentId);
  let greeting: string;
  if (r.overall == null) {
    greeting = `Hi ${firstName}! I'm Averna AI. Take a test in any skill and I'll build you a personal plan toward your target band.`;
  } else if (r.weakest) {
    greeting = `Hi ${firstName}! You're at ~Band ${r.overall.toFixed(1)}. Your biggest opportunity right now is ${r.weakest.label} (Band ${r.weakest.predicted?.toFixed(1)}) — want a plan?`;
  } else {
    greeting = `Hi ${firstName}! You're at ~Band ${r.overall.toFixed(1)}. Ask me what to study, why you're stuck, or your fastest path to your goal.`;
  }
  return <AvernaAi greeting={greeting} />;
}
