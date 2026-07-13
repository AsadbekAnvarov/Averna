export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMockExamById } from "@/lib/mock-exams-data";
import { MockExamRunner } from "@/components/mock-exam-runner";

interface Props {
  params: { examId: string };
}

export default async function MockExamRunnerPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const exam = getMockExamById(params.examId);
  if (!exam) redirect("/learning/mock-exam");

  return <MockExamRunner exam={exam} />;
}
