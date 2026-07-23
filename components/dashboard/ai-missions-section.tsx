import { getExamReadiness } from "@/lib/student-intel";
import { DECKS } from "@/lib/flashcards-data";
import { tashkentDateKey } from "@/lib/utils";
import { AiMissions } from "@/components/dashboard/ai-missions";

const HREF: Record<string, string> = {
  READING: "/learning/reading",
  LISTENING: "/learning/listening",
  WRITING: "/learning/writing",
  SPEAKING: "/learning/speaking",
};

/**
 * F6 — AI Challenge Generator (server). Builds personalised daily missions from
 * the student's real weakest/strongest skills, plus a date-seeded vocabulary
 * deck and targets. Deterministic per day. Completion is tracked locally by the
 * client (no server points mutation).
 */
export async function AiMissionsSection({ studentId }: { studentId: string }) {
  const r = await getExamReadiness(studentId);
  const date = tashkentDateKey();
  const seed = Number(date.replaceAll("-", "")) || 1;

  const withData = r.perSkill.filter((s) => s.predicted != null);
  const weakest = r.weakest;
  const strong = withData.length ? withData.reduce((hi, s) => (s.predicted! > hi.predicted! ? s : hi)) : null;

  const words = 10 + (seed % 11); // 10-20
  const minutes = 8 + (seed % 8); // 8-15
  const deck = DECKS[seed % DECKS.length];

  const missions = [] as { id: string; title: string; detail: string; xp: number; href: string }[];

  if (weakest) {
    missions.push({
      id: "weak",
      title: `Take a ${weakest.label} test`,
      detail: "Your lowest predicted band — the fastest place to gain points.",
      xp: 60,
      href: HREF[weakest.key] ?? "/learning",
    });
  } else {
    missions.push({
      id: "weak",
      title: "Take a mock test",
      detail: "Kick off your data so tomorrow's missions get personal.",
      xp: 60,
      href: "/learning",
    });
  }

  missions.push({
    id: "vocab",
    title: `Learn ${words} words from “${deck.name}”`,
    detail: `Fresh ${deck.name.toLowerCase()} vocabulary for Band 7+.`,
    xp: 40,
    href: "/learning",
  });

  missions.push({
    id: "speak",
    title: `Practice Speaking for ${minutes} minutes`,
    detail: "Fluency grows with short daily reps.",
    xp: 50,
    href: HREF.SPEAKING,
  });

  if (strong) {
    missions.push({
      id: "strong",
      title: `Keep ${strong.label} sharp`,
      detail: "Protect your strongest skill with a quick session.",
      xp: 30,
      href: HREF[strong.key] ?? "/learning",
    });
  }

  return <AiMissions date={date} missions={missions} />;
}
