export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSpeakingContent } from "@/lib/speaking-content";
import { soloPracticeFallback } from "@/lib/speaking/peer-content";
import { SpeakingRunner } from "@/components/learning/speaking-runner";

export const metadata = { title: "Practise Speaking alone" };

/** Solo Part 1/2/3 practice: published practice sets, or the peer conversation bank when none are published. */
export default async function SoloSpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const published = await getSpeakingContent();
  const fallback = soloPracticeFallback();
  return (
    <SpeakingRunner
      part1Topics={published.part1Topics.length ? published.part1Topics : fallback.part1Topics}
      part2Cards={published.part2Cards.length ? published.part2Cards : fallback.part2Cards}
      part3Questions={published.part3Questions.length ? published.part3Questions : fallback.part3Questions}
    />
  );
}
