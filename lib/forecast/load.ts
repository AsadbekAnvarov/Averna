/**
 * Server loader for the band forecast. Reuses the progression engine's
 * request-cached `loadSessions` (newest 200 verified results, already read for
 * Today / Progress), so the forecast adds no extra query. The pure model runs
 * in the client cards (the exam date and the what-if live on the device).
 */
import { cache } from "react";
import { contentKeyOf, loadSessions } from "@/lib/engine/progression/service";
import { parseTargetBand } from "@/lib/engine/progression/skills";
import { SKILLS } from "@/lib/engine/progression/config";
import { dayKeyOf, paceFromSessions, selectForecastResults, type EvidenceItem, type ForecastInput } from "./band-forecast";

const asRec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const loadForecastInput = cache(async (studentId: string, targetBand: string | null | undefined): Promise<ForecastInput> => {
  const sessions = await loadSessions(studentId);
  const now = Date.now();
  const items: EvidenceItem[] = sessions
    .filter(({ fact }) => SKILLS.includes(fact.skill))
    .map(({ row, fact }) => {
      const ai = asRec(row.aiAnalysis) ?? {};
      const a = asRec(row.answers) ?? {};
      return {
        skill: fact.skill,
        band: fact.band,
        at: fact.at,
        contentKey: contentKeyOf(row.answers),
        questions: num(ai.totalQuestions) ?? num(a.lTotal) ?? num(a.rTotal),
        words: fact.words,
        seconds: fact.seconds,
        task: fact.task,
      };
    });
  return {
    results: selectForecastResults(items),
    targetBand: parseTargetBand(targetBand),
    now,
    todayKey: dayKeyOf(now),
    pace: paceFromSessions(items, now),
  };
});
