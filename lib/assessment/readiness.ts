/** Descriptive practice evidence, NOT a validated forecast or confidence interval. */
export const READINESS_SKILLS = ["READING", "LISTENING", "WRITING", "SPEAKING"] as const;
export type ReadinessSkill = typeof READINESS_SKILLS[number];
export interface ReadinessEvidence {
  id: string; module: string; score: number; completedAt: Date; contentKey: string | null;
  format: string | null; part: string | null; totalQuestions: string | null; answeredCount: string | null;
  source: string | null; taskType: string | null; examAttemptId: string | null;
  recorded: string | null; typedAnswers: string | null; teacherBand: number | null;
  speakingParts?: unknown; pronunciation?: string | null;
}
const LABELS: Record<ReadinessSkill, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };
function completeSpeaking(row: ReadinessEvidence): boolean {
  if (row.pronunciation == null || !valid(Number(row.pronunciation)) || !Array.isArray(row.speakingParts)) return false;
  const parts = row.speakingParts;
  return [1, 2, 3].every(part => parts.some((p: unknown) => {
    if (!p || typeof p !== "object") return false;
    const item = p as { part?: unknown; words?: unknown; seconds?: unknown };
    return item.part === part && typeof item.words === "number" && item.words > 0 && typeof item.seconds === "number" && item.seconds > 0;
  }));
}
const round = (n: number) => Math.round(n * 2) / 2;
const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 9;
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}
export function practiceReadiness(rows: ReadinessEvidence[], now = new Date()) {
  const cutoff = now.getTime() - 90 * 86400000;
  const recent = rows.filter(r => READINESS_SKILLS.includes(r.module as ReadinessSkill) && r.completedAt.getTime() >= cutoff && r.completedAt <= now && valid(r.teacherBand ?? r.score))
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime() || a.id.localeCompare(b.id));
  const perSkill = READINESS_SKILLS.map(key => {
    const seen = new Set<string>();
    const accepted: { band: number; at: Date; full: boolean; source: string }[] = [];
    const pairs = new Map<string, ReadinessEvidence[]>();
    let excluded = 0;
    for (const row of recent.filter(r => r.module === key)) {
      const human = valid(row.teacherBand);
      const source = human ? "teacher" : row.source;
      const objective = key === "READING" || key === "LISTENING";
      const supported = objective ? row.format === "exam-v2" && Number(row.totalQuestions) > 0 && Number(row.answeredCount) > 0
        : key === "WRITING" ? human || source === "ai"
        // Transcript-only estimates do not measure pronunciation or a full spoken performance.
        : human && row.format === "exam-v2" && row.recorded === "true" && !Number(row.typedAnswers);
      if (!supported || !row.contentKey) { excluded++; continue; }
      if (seen.has(row.contentKey)) { excluded++; continue; }
      seen.add(row.contentKey);
      if (key === "WRITING" && row.examAttemptId && (row.taskType === "task1" || row.taskType === "task2")) {
        const pair = pairs.get(row.examAttemptId) ?? [];
        pair.push(row); pairs.set(row.examAttemptId, pair);
        continue;
      }
      accepted.push({ band: row.teacherBand ?? row.score, at: row.completedAt, source: human ? "teacher" : objective ? "answer key" : "AI-assisted", full: objective ? row.part == null && Number(row.totalQuestions) === 40 && Number(row.answeredCount) === 40 : key === "SPEAKING" && completeSpeaking(row) });
    }
    for (const pair of pairs.values()) {
      const first = pair.find(r => r.taskType === "task1");
      const second = pair.find(r => r.taskType === "task2");
      if (first && second) {
        accepted.push({ band: round(((first.teacherBand ?? first.score) + 2 * (second.teacherBand ?? second.score)) / 3), at: new Date(Math.max(first.completedAt.getTime(), second.completedAt.getTime())), full: true, source: first.teacherBand != null && second.teacherBand != null ? "teacher" : "AI-assisted / teacher" });
      } else for (const r of pair) accepted.push({ band: r.teacherBand ?? r.score, at: r.completedAt, full: false, source: r.teacherBand != null ? "teacher" : "AI-assisted" });
    }
    accepted.sort((a, b) => b.at.getTime() - a.at.getTime());
    const sample = accepted.slice(0, 6);
    const full = accepted.filter(r => r.full).slice(0, 6);
    const days = new Set(full.map(r => new Date(r.at.getTime() + 5 * 3600000).toISOString().slice(0, 10))).size;
    const current = sample.length ? median(sample.map(r => r.band)) : null;
    const range = sample.length ? [Math.min(...sample.map(r => r.band)), Math.max(...sample.map(r => r.band))] as [number, number] : null;
    const trend = sample.length < 6 ? null : (() => {
      const change = median(sample.slice(0, 3).map(r => r.band)) - median(sample.slice(3, 6).map(r => r.band));
      return change > 0.25 ? "up" as const : change < -0.25 ? "down" as const : "flat" as const;
    })();
    return { key, label: LABELS[key], current, predicted: current, range, trend, sampleSize: sample.length, fullSampleSize: full.length,
      fullBand: full.length >= 2 && days >= 2 ? median(full.map(r => r.band)) : null,
      sources: [...new Set(sample.map(r => r.source))], excluded,
      basis: sample.length ? `${sample.length} distinct recent practice result${sample.length === 1 ? "" : "s"}; latest result for repeated content. ${full.length} complete result${full.length === 1 ? "" : "s"}.` : "No eligible recent evidence. Short, unknown-source and text-metric results do not establish exam readiness." };
  });
  const complete = perSkill.every(s => s.fullBand != null);
  const overall = complete ? round(perSkill.reduce((n, s) => n + s.fullBand!, 0) / 4) : null;
  const withData = perSkill.filter(s => s.current != null);
  const weakest = withData.length ? withData.reduce((a, b) => a.current! <= b.current! ? a : b) : null;
  const missing = perSkill.filter(s => s.fullBand == null).map(s => s.label);
  return { overall, confidence: null, perSkill, weakest,
    narrative: overall == null ? `No overall readiness number yet. More complete evidence on different days is needed for ${missing.join(", ")}.` : "An equal-weight summary of recent complete practice across four skills — not a prediction of your official IELTS result.",
    recommendations: [weakest ? `Consider ${weakest.label} practice: it has your lowest eligible recent practice median.` : "Start with a complete Reading or Listening paper to build evidence.", "Teacher-reviewed recorded Speaking is required; transcript-only AI feedback cannot establish pronunciation readiness."],
  };
}
