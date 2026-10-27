/**
 * "Who needs help today" — the teacher's morning list (docs/elegance-roadmap.md,
 * idea 10). Pure and deterministic: per-student signals in, a ranked list out.
 *
 * Every signal only counts once it crosses its threshold, and then adds a
 * component that never shrinks as the signal grows, so the score is monotonic
 * in each signal. A student with no reason is not on the list (honesty: no
 * filler rows). Each row carries at most three short reasons (the heaviest
 * first) and one suggested next step.
 *
 * Order: score (high first), then name, then id — a total order, so the list
 * never depends on the order the students were read in.
 */

/** Rows shown before "Show all (N)". */
export const NEEDS_HELP_SHOWN = 8;
/** Reasons shown per row. */
export const MAX_REASONS = 3;

/** Thresholds (documented in the roadmap): below them a signal is not a reason. */
export const NEEDS_HELP_RULES = {
  /** Whole days without any activity. */
  inactiveDays: 4,
  /** A streak at least this long that broke in the last two days. */
  brokenStreak: 3,
  /** Wrong answers of a question type among its last `kindWindow` questions. */
  kindWrong: 3,
  kindWindow: 5,
  /** Forecast "now" at least this far below the target. */
  targetGap: 1,
  /** Writing / Speaking work waiting for the teacher's review at least this many days (48 h). */
  reviewDays: 2,
  /** Absences counted over this many days. */
  absenceDays: 14,
  /** Missed homework counted over this many days. */
  missedHomeworkDays: 21,
} as const;

export type ReasonKind = "report" | "review" | "homework" | "inactive" | "absence" | "streak" | "mistakes" | "falling" | "target";

/** Ties between equally heavy reasons go to this order. */
const REASON_ORDER: ReasonKind[] = ["report", "homework", "inactive", "absence", "review", "streak", "mistakes", "falling", "target"];

export interface StudentSignals {
  /** Student.id */
  id: string;
  /** User.id (messages). */
  userId: string;
  name: string;
  group: string;
  /** Unsubmitted homework whose deadline passed (last 21 days). */
  missedHomework: number;
  /** Whole days since the last activity; for a student who never practised, days since joining. null = unknown. */
  daysInactive: number | null;
  /** Never logged any activity (changes the wording only). */
  neverActive?: boolean;
  /** Length of a streak (≥ 3) that broke in the last two days, else 0. */
  brokenStreak: number;
  /** Skills whose forecast trend points down ("Listening"). */
  fallingSkills: string[];
  /** Forecast overall "now" and the student's target. */
  forecast: { now: number; target: number } | null;
  /** The question type with the most wrong answers among its last 5 questions. */
  weakKind: { kind: string; label: string; wrong: number; of: number } | null;
  /** Absences (ABSENT) in the last 14 days. */
  absences: number;
  /** Open peer-speaking safety reports about the student. */
  openReports: number;
  /** Writing / Speaking attempts waiting for review, the oldest first. */
  waitingReview: { count: number; oldestDays: number; testId: string; skill: "WRITING" | "SPEAKING" } | null;
}

export interface NeedsHelpReason {
  kind: ReasonKind;
  /** "No activity for 6 days" */
  text: string;
  /** This reason's share of the score. */
  weight: number;
}

export type NeedsHelpAction =
  | { kind: "message"; label: string }
  | { kind: "mini-task"; label: string }
  | { kind: "review"; label: string; href: string }
  | { kind: "reports"; label: string; href: string };

export interface NeedsHelpRow {
  id: string;
  userId: string;
  name: string;
  group: string;
  initials: string;
  score: number;
  /** 1–3, heaviest first. */
  reasons: NeedsHelpReason[];
  action: NeedsHelpAction;
  /** Editable, template-built first message ("Message" without an AI key). */
  messageDraft: string;
}

const n0 = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, x) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const band = (b: number) => (Math.round(b * 2) / 2).toFixed(1);

function listJoin(xs: string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** "Aziza Karimova" → "AK"; one name → its first two letters. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** Every reason that applies, each with its (monotonic) weight. */
export function reasonsOf(s: StudentSignals): NeedsHelpReason[] {
  const R = NEEDS_HELP_RULES;
  const out: NeedsHelpReason[] = [];

  const reports = Math.min(3, Math.floor(n0(s.openReports)));
  if (reports >= 1) {
    out.push({ kind: "report", weight: 40 + 10 * (reports - 1), text: reports === 1 ? "Peer speaking report open" : `${reports} peer speaking reports open` });
  }

  const missed = Math.floor(n0(s.missedHomework));
  if (missed >= 1) out.push({ kind: "homework", weight: 12 * Math.min(missed, 5), text: `Missed ${plural(missed, "homework", "homework")}` });

  const idle = s.daysInactive == null ? 0 : Math.floor(n0(s.daysInactive));
  if (idle >= R.inactiveDays) {
    out.push({
      kind: "inactive",
      weight: 10 + 2 * Math.min(idle, 30),
      text: s.neverActive ? `No practice yet (${plural(idle, "day")})` : `No activity for ${plural(idle, "day")}`,
    });
  }

  const absent = Math.floor(n0(s.absences));
  if (absent >= 1) out.push({ kind: "absence", weight: 10 * Math.min(absent, 5), text: absent === 1 ? "Absent once in 2 weeks" : `Absent ${absent} times in 2 weeks` });

  const w = s.waitingReview;
  if (w && w.count >= 1 && n0(w.oldestDays) >= R.reviewDays) {
    const days = Math.floor(n0(w.oldestDays));
    const what = w.skill === "SPEAKING" ? "Speaking" : "Essay";
    out.push({
      kind: "review",
      weight: 6 + 2 * Math.min(days, 14) + 2 * Math.min(Math.floor(w.count), 5),
      text: w.count > 1 ? `${w.count} attempts waiting for review` : `${what} waiting ${plural(days, "day")} for review`,
    });
  }

  const streak = Math.floor(n0(s.brokenStreak));
  if (streak >= R.brokenStreak) out.push({ kind: "streak", weight: 8 + Math.min(streak, 30) / 2, text: `Lost a ${streak}-day streak` });

  const k = s.weakKind;
  if (k && n0(k.wrong) >= R.kindWrong) {
    const wrong = Math.floor(n0(k.wrong));
    out.push({ kind: "mistakes", weight: 5 + 3 * Math.min(wrong, R.kindWindow), text: `${k.label}: ${wrong} of ${Math.max(wrong, Math.floor(n0(k.of)))} wrong` });
  }

  const falling = Array.from(new Set(s.fallingSkills.filter((x) => typeof x === "string" && x))).sort();
  if (falling.length) {
    out.push({
      kind: "falling",
      weight: 8 * Math.min(falling.length, 4),
      text: falling.length === 1 ? `${falling[0]} trend falling` : `${listJoin(falling)} trends falling`,
    });
  }

  const f = s.forecast;
  if (f && Number.isFinite(f.now) && Number.isFinite(f.target) && f.target - f.now >= R.targetGap) {
    out.push({ kind: "target", weight: 6 + 4 * Math.min(f.target - f.now, 4), text: `Band ${band(f.now)} vs target ${band(f.target)}` });
  }

  return out.sort((a, b) => b.weight - a.weight || REASON_ORDER.indexOf(a.kind) - REASON_ORDER.indexOf(b.kind));
}

/** The one next step that fits the heaviest reason. */
export function suggestedAction(top: NeedsHelpReason, s: StudentSignals): NeedsHelpAction {
  switch (top.kind) {
    case "report":
      return { kind: "reports", label: "See report", href: "/teacher/speaking" };
    case "review":
      return s.waitingReview
        ? { kind: "review", label: "Review", href: `/teacher/reviews/${encodeURIComponent(s.waitingReview.testId)}` }
        : { kind: "message", label: "Message" };
    case "mistakes":
    case "falling":
    case "target":
      return { kind: "mini-task", label: "Mini task" };
    default:
      return { kind: "message", label: "Message" };
  }
}

/** A phrase for the student's message (null = not something to raise with the student). */
function phraseOf(r: NeedsHelpReason, s: StudentSignals): string | null {
  switch (r.kind) {
    case "homework": {
      const n = Math.floor(n0(s.missedHomework));
      return n === 1 ? "one homework is overdue" : `${n} homework tasks are overdue`;
    }
    case "inactive":
      return s.neverActive ? "you haven't started practising on Averna yet" : `you haven't practised for ${plural(Math.floor(n0(s.daysInactive)), "day")}`;
    case "absence":
      return Math.floor(n0(s.absences)) === 1 ? "you missed a lesson recently" : `you missed ${Math.floor(n0(s.absences))} lessons in the last two weeks`;
    case "streak":
      return `your ${Math.floor(n0(s.brokenStreak))}-day streak ended`;
    case "mistakes":
      return s.weakKind ? `${s.weakKind.label.toLowerCase()} questions have been tricky lately` : null;
    case "falling":
      return `your ${listJoin(s.fallingSkills.slice().sort())} results have dipped a little`;
    case "target":
      return s.forecast ? `there's still a gap to your ${band(s.forecast.target)} target` : null;
    default:
      return null; // reports and the review backlog are the teacher's to handle, not the student's
  }
}

/** A short, kind first message the teacher edits before sending. */
export function messageTemplate(s: StudentSignals, reasons: NeedsHelpReason[], action: NeedsHelpAction): string {
  const phrases = reasons.map((r) => phraseOf(r, s)).filter((p): p is string => !!p).slice(0, 2);
  const hello = `Hi ${firstNameOf(s.name)},`;
  const noticed = phrases.length ? ` I noticed ${listJoin(phrases)}.` : "";
  const close =
    action.kind === "mini-task"
      ? " I'm sending you a short practice task for it — about 10 minutes. You've got this."
      : " Is everything OK? Even 10 minutes of practice today would help — tell me if you need anything.";
  return `${hello}${noticed}${close}`;
}

/** One student's row, or null when there is nothing to say. */
export function needsHelpRow(s: StudentSignals): NeedsHelpRow | null {
  const all = reasonsOf(s);
  if (!all.length) return null;
  const score = Math.round(all.reduce((t, r) => t + r.weight, 0) * 10) / 10;
  const reasons = all.slice(0, MAX_REASONS);
  const action = suggestedAction(reasons[0], s);
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    group: s.group,
    initials: initialsOf(s.name),
    score,
    reasons,
    action,
    messageDraft: messageTemplate(s, reasons, action),
  };
}

const byName = (a: string, b: string) => {
  const x = a.toLocaleLowerCase("en");
  const y = b.toLocaleLowerCase("en");
  return x < y ? -1 : x > y ? 1 : 0;
};

/** The ranked list: only students with a reason; score, then name, then id. */
export function rankNeedsHelp(students: readonly StudentSignals[]): NeedsHelpRow[] {
  const seen = new Set<string>();
  const rows: NeedsHelpRow[] = [];
  for (const s of students) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const row = needsHelpRow(s);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => b.score - a.score || byName(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
