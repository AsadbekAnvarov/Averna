import { Info, Target, TrendingUp, Trophy } from "lucide-react";
import { listeningBand, rawNeededFor, readingBand, scaledRaw } from "@/lib/ielts/bands";
import { partNoun, plural, type ObjectiveSkill } from "./attempt";

/**
 * "How far is the next band?" — exact for full 40-question papers (the
 * published raw-score tables via rawNeededFor); for a single passage / part
 * the band is an estimate scaled to 40 questions, and the component says so.
 */

const FULL = 40;

function bandOf(skill: ObjectiveSkill, correct: number, total: number): number {
  return skill === "READING" ? readingBand(correct, total) : listeningBand(correct, total);
}

/** Smallest score on THIS paper that reaches `target` (null when even full marks don't). */
function neededOnPaper(skill: ObjectiveSkill, target: number, total: number, from = 0): number | null {
  for (let c = Math.max(0, from); c <= total; c++) if (bandOf(skill, c, total) >= target) return c;
  return null;
}

export function NextBand({
  skill,
  band,
  correct,
  total,
  part,
  target,
}: {
  skill: ObjectiveSkill;
  band: number;
  correct: number;
  total: number;
  /** Practised part index, or null for the whole paper. */
  part: number | null;
  /** The student's target band, when set in their profile. */
  target?: number | null;
}) {
  if (total <= 0) return null;
  const full = total === FULL;
  const noun = part == null ? "paper" : partNoun(skill);

  let headline: string;
  let detail: string | null = null;
  let top = false;

  if (band >= 9) {
    top = true;
    headline = "Band 9.0 — the top of the scale";
    detail = full ? "Keep this accuracy under exam timing and the band is yours on test day." : null;
  } else if (full) {
    const raw = rawNeededFor(band + 0.5, skill);
    if (raw != null && raw > correct) {
      const next = bandOf(skill, raw, FULL);
      headline = `${plural(raw - correct, "more correct answer")} for band ${next.toFixed(1)}`;
      detail = `Band ${next.toFixed(1)} starts at ${raw} / 40. You scored ${correct} / 40.`;
    } else {
      headline = `You're at band ${band.toFixed(1)}`;
    }
  } else {
    const c = neededOnPaper(skill, band + 0.5, total, correct + 1);
    if (c != null) {
      const next = bandOf(skill, c, total);
      headline = `${plural(c - correct, "more correct answer")} on this ${noun} would lift the estimate to band ${next.toFixed(1)}`;
    } else {
      headline = `Estimated band ${band.toFixed(1)}`;
    }
  }

  let targetLine: string | null = null;
  if (target != null && target > band) {
    if (full) {
      const raw = rawNeededFor(target, skill);
      if (raw != null) targetLine = `Your target band ${target.toFixed(1)} needs ${raw} / 40 — ${plural(Math.max(0, raw - correct), "more correct answer")}.`;
    } else {
      const c = neededOnPaper(skill, target, total);
      targetLine =
        c != null
          ? `For your target band ${target.toFixed(1)}, aim for ${c} / ${total} on a ${noun} like this.`
          : `Your target band ${target.toFixed(1)} needs full marks on a ${noun} this size — the full test measures it more fairly.`;
    }
  } else if (target != null && band >= target) {
    targetLine = `You reached your target band ${target.toFixed(1)}.`;
  }

  const Icon = top ? Trophy : TrendingUp;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <p className="flex items-start gap-2.5 text-sm font-semibold text-white sm:text-base">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        <span>{headline}</span>
      </p>
      {detail && <p className="mt-1 pl-[1.625rem] text-sm text-gray-400">{detail}</p>}
      {targetLine && (
        <p className="mt-2 flex items-start gap-2.5 text-sm text-gray-300">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
          <span>{targetLine}</span>
        </p>
      )}
      {!full && (
        <p className="mt-3 flex items-start gap-2.5 border-t border-white/10 pt-3 text-xs leading-relaxed text-gray-400 sm:text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <span>
            This {noun} has {plural(total, "question")}, so the band is an estimate: your score is scaled to a 40-question
            paper ({correct} / {total} ≈ {scaledRaw(correct, total)} / 40) and read from the published{" "}
            {skill === "READING" ? "Academic Reading" : "Listening"} conversion table. Take the full test for an exact band.
          </span>
        </p>
      )}
    </div>
  );
}
