export const dynamic = "force-dynamic";
// Opening the view may first mark a section whose clock ran out while the student was away
// (Writing / Speaking go to the AI examiner).
export const maxDuration = 60;

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockView } from "@/lib/ielts/mock";
import { MockOrchestrator } from "@/components/exam/mock-orchestrator";

export const metadata = { title: "IELTS mock exam" };

const HUB = "/learning/mock-exam";

/** One sitting of the real mock exam. `examId` is the MockAttempt id (old demo ids simply lead back to the hub). */
export default async function MockExamRunPage(props: { params: Promise<{ examId: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) return redirect(HUB);

  const view = await getMockView(student.id, session.user.id, params.examId);
  if (!view) return redirect(HUB);
  if (view.stage.kind === "finished") return redirect(`${HUB}/result/${encodeURIComponent(view.attemptId)}`);
  if (view.stage.kind === "abandoned") return redirect(HUB);

  return <MockOrchestrator view={view} serverNow={Date.now()} />;
}
