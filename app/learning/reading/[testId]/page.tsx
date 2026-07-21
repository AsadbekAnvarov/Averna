export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ReadingTest from "@/components/learning/reading-test";
import { getReadingTest } from "@/lib/reading-content";

export default async function ReadingTestPage({
  params,
}: {
  params: { testId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const test = await getReadingTest(params.testId);

  if (!test) {
    redirect("/learning/reading");
  }

  return <ReadingTest test={test} userId={session.user.id} />;
}
