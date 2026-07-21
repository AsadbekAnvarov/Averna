export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listListeningTests } from "@/lib/listening-content";
import { ListeningRunner } from "@/components/learning/listening-runner";

export default async function ListeningPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const tests = await listListeningTests();

  return <ListeningRunner tests={tests} />;
}
