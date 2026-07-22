export const dynamic = "force-dynamic";

import { getSpeakingContent } from "@/lib/speaking-content";
import { getTodayTopic } from "@/lib/speaking-topics";
import { SpeakingRunner } from "@/components/learning/speaking-runner";

export default async function SpeakingPage() {
  const { part1Topics, part2Cards, part3Questions } = await getSpeakingContent();
  const todayTopic = getTodayTopic();

  return (
    <SpeakingRunner
      part1Topics={part1Topics}
      part2Cards={part2Cards}
      part3Questions={part3Questions}
      todayTopic={todayTopic}
    />
  );
}
