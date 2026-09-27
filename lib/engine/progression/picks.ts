/**
 * Content picks — pure. Chooses the concrete exam material a mission step or a
 * recommendation links to, from catalog summaries (lib/ielts/catalog) and the
 * content keys of the student's earlier attempts — IELTSTest `answers.testId`:
 *
 *   "<examId>"               a whole paper (or a single-part test)
 *   "<examId>#p<n>"          one part of a multi-part paper (n is 1-based)
 *   "speaking-test:<setId>"  a full Speaking test
 *
 * Preference: material the student has never met → parts of real (full) exam
 * papers before the older short tests → the next part of a paper already in
 * progress → closest to the student's level → catalog order (Averna originals
 * before generated, legacy last). When everything has been met, the
 * least-attempted material wins, and the pick carries its attempt count so the
 * XP estimate can include repeat decay.
 *
 * The service loads the catalog and the attempts; this module only decides.
 */

/** The catalog fields the picker needs (ExamTestSummary is compatible). */
export interface ExamSummaryLike {
  id: string;
  title: string;
  difficulty: string;
  questions: number;
  parts: number;
  partInfo: { title: string; from: number; to: number }[];
  /** Minutes for the whole paper. */
  timeLimit: number;
  /** Full exam format (3 passages / 4 parts, 40 questions). */
  full: boolean;
}

export interface ExamPick {
  examId: string;
  /** 0-based part index (the `?part=` of the practice route); null = the whole paper. */
  part: number | null;
  /** Paper title. */
  title: string;
  /** Passage / part title when `part` is set. */
  partTitle: string | null;
  questions: number;
  /** Minutes for a whole paper or single-part test; null for one part (see MISSION_CONFIG.minutes). */
  minutes: number | null;
  difficulty: string;
  /** Earlier attempts of exactly this content key (drives repeat decay). */
  attempts: number;
  /** The student has met this material before (this part, or the whole paper). */
  seen: boolean;
}

export interface SpeakingPick {
  id: string;
  title: string;
  attempts: number;
}

/** How often each content key was attempted. */
export type AttemptCounts = ReadonlyMap<string, number>;

export function countContentKeys(keys: Iterable<string | null | undefined>): Map<string, number> {
  const out = new Map<string, number>();
  for (const k of keys) if (k) out.set(k, (out.get(k) ?? 0) + 1);
  return out;
}

export const partKey = (examId: string, part: number) => `${examId}#p${part + 1}`;
export const speakingKey = (setId: string) => `speaking-test:${setId}`;

const LEVEL_RANK: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
const levelGap = (difficulty: string, level: string | null | undefined) =>
  level ? Math.abs((LEVEL_RANK[difficulty] ?? 1) - (LEVEL_RANK[level] ?? 1)) : 0;

/** Lexicographic comparison of rank tuples (lower is better). */
function byRank<T>(rank: (t: T) => number[]) {
  return (a: T, b: T) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  };
}

function partQuestions(e: ExamSummaryLike, i: number): number {
  const r = e.partInfo[i];
  const n = r && r.to >= r.from && r.from > 0 ? r.to - r.from + 1 : 0;
  return n > 0 ? n : Math.max(1, Math.round(e.questions / Math.max(1, e.parts)));
}

/**
 * One passage / part — the daily-mission size. Multi-part papers offer each
 * part separately; single-part tests count as one part.
 */
export function pickPart(
  exams: ExamSummaryLike[],
  attempts: AttemptCounts,
  opts: { level?: string | null } = {}
): ExamPick | null {
  interface Cand {
    exam: ExamSummaryLike;
    index: number;
    part: number | null;
    tries: number;
    seen: boolean;
    started: boolean;
  }
  const cands: Cand[] = [];
  exams.forEach((exam, index) => {
    const paperTries = attempts.get(exam.id) ?? 0;
    const multi = exam.parts > 1 && exam.partInfo.length === exam.parts;
    if (!multi) {
      cands.push({ exam, index, part: null, tries: paperTries, seen: paperTries > 0, started: false });
      return;
    }
    const partTries = exam.partInfo.map((_, i) => attempts.get(partKey(exam.id, i)) ?? 0);
    // A paper in progress: some parts practised, never sat in full.
    const started = paperTries === 0 && partTries.some((t) => t > 0);
    partTries.forEach((tries, i) =>
      cands.push({ exam, index, part: i, tries, seen: tries > 0 || paperTries > 0, started })
    );
  });
  if (!cands.length) return null;
  cands.sort(
    byRank((c) => [
      c.seen ? 1 : 0,
      c.seen ? c.tries : 0,
      c.exam.full ? 0 : 1, // real exam passages before the older short tests
      c.started ? 0 : 1, // finish the paper already in progress
      levelGap(c.exam.difficulty, opts.level),
      c.index,
      c.part ?? 0,
    ])
  );
  const c = cands[0];
  return {
    examId: c.exam.id,
    part: c.part,
    title: c.exam.title,
    partTitle: c.part != null ? c.exam.partInfo[c.part]?.title || null : null,
    questions: c.part != null ? partQuestions(c.exam, c.part) : c.exam.questions,
    minutes: c.part != null ? null : c.exam.timeLimit,
    difficulty: c.exam.difficulty,
    attempts: c.tries,
    seen: c.seen,
  };
}

/** A full paper (40 questions) — bigger goals. Null when the catalog has none. */
export function pickFull(
  exams: ExamSummaryLike[],
  attempts: AttemptCounts,
  opts: { level?: string | null } = {}
): ExamPick | null {
  const cands = exams
    .map((exam, index) => {
      const tries = attempts.get(exam.id) ?? 0;
      const partsDone = exam.partInfo.some((_, i) => (attempts.get(partKey(exam.id, i)) ?? 0) > 0);
      return { exam, index, tries, partsDone };
    })
    .filter((c) => c.exam.full);
  if (!cands.length) return null;
  cands.sort(
    byRank((c) => [c.tries > 0 ? 1 : 0, c.partsDone ? 1 : 0, c.tries, levelGap(c.exam.difficulty, opts.level), c.index])
  );
  const c = cands[0];
  return {
    examId: c.exam.id,
    part: null,
    title: c.exam.title,
    partTitle: null,
    questions: c.exam.questions,
    minutes: c.exam.timeLimit,
    difficulty: c.exam.difficulty,
    attempts: c.tries,
    seen: c.tries > 0 || c.partsDone,
  };
}

/** A full Speaking test set — the one taken least often, in catalog order. */
export function pickSpeakingSet(sets: { id: string; title: string }[], attempts: AttemptCounts): SpeakingPick | null {
  const cands = sets.map((s, index) => ({ s, index, tries: attempts.get(speakingKey(s.id)) ?? 0 }));
  if (!cands.length) return null;
  cands.sort(byRank((c) => [c.tries, c.index]));
  const c = cands[0];
  return { id: c.s.id, title: c.s.title, attempts: c.tries };
}
