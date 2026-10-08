export interface MistakeCard {
  id: string;
  wrong: string;
  right: string;
  note: string | null;
  sourceTestId: string | null;
  practiceCount: number;
  lastPracticedAt: string | null;
  createdAt: string;
}
export const MAX_MISTAKES = 500;
export function normalizeCorrection(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .toLocaleLowerCase("en");
}
export function correctionMatches(answer: unknown, expected: string): boolean {
  return (
    typeof answer === "string" &&
    answer.length <= 2000 &&
    normalizeCorrection(answer) !== "" &&
    normalizeCorrection(answer) === normalizeCorrection(expected)
  );
}
export function parseMistake(
  raw: unknown,
): {
  id: string;
  wrong: string;
  right: string;
  note: string | null;
  sourceTestId: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const wrong = typeof r.wrong === "string" ? r.wrong.trim() : "";
  const right = typeof r.right === "string" ? r.right.trim() : "";
  if (
    !/^[\w-]{1,100}$/.test(id) ||
    !wrong ||
    !right ||
    wrong.length > 2000 ||
    right.length > 2000 ||
    normalizeCorrection(wrong) === normalizeCorrection(right)
  )
    return null;
  if (r.note != null && (typeof r.note !== "string" || r.note.length > 2000))
    return null;
  if (
    r.sourceTestId != null &&
    (typeof r.sourceTestId !== "string" || r.sourceTestId.length > 100)
  )
    return null;
  return {
    id,
    wrong,
    right,
    note: typeof r.note === "string" ? r.note.trim() || null : null,
    sourceTestId: typeof r.sourceTestId === "string" ? r.sourceTestId : null,
  };
}
