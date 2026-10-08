export const dynamic = "force-dynamic";
import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { MistakeBank } from "@/components/learning/mistake-bank";
import { getPageStudent } from "@/lib/student-page";
import { db } from "@/lib/db";
export const metadata = { title: "Correction Studio · Practice Studio" };
export default async function MistakesPage(props: { searchParams: Promise<{ from?: string; issue?: string }> }) {
  const searchParams = (await props.searchParams) ?? {};
  const { session, student } = await getPageStudent();
  let seed: { wrong: string; note: string; sourceTestId: string } | undefined;
  if (student && searchParams.from && /^\d+$/.test(searchParams.issue ?? "")) {
    const test = await db.iELTSTest.findFirst({ where: { id: searchParams.from, studentId: student.id, module: "WRITING" }, select: { id: true, aiAnalysis: true } });
    const issues = (test?.aiAnalysis as { issues?: { text?: unknown; suggestion?: unknown; type?: unknown }[] } | null)?.issues;
    const issue = Array.isArray(issues) ? issues[Number(searchParams.issue)] : null;
    if (test && issue && issue.type !== "good" && typeof issue.text === "string" && typeof issue.suggestion === "string") seed = { wrong: issue.text.slice(0, 2000), note: issue.suggestion.slice(0, 2000), sourceTestId: test.id };
  }
  return <StudioToolPage slug="mistakes"><MistakeBank key={session.user.id} userId={session.user.id} seed={seed} /></StudioToolPage>;
}
