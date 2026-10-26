import { listListeningExams, listReadingExams } from "@/lib/ielts/catalog";
import type { ExamListeningTest, ExamReadingTest, GradeItem } from "@/lib/ielts/types";
import { doneContentKeys } from "@/lib/review/practice-data";
import { mistakesByKind, pickPracticePart } from "@/lib/review/practice-by-type";
import type { ObjectiveSkill } from "./attempt";
import { kindResolver, MistakesByTypeCard, type MistakeLine } from "./mistakes-by-type-card";

/** Loads the catalog and the student's done papers, then renders the card. Server component. */
export async function MistakesByTypeSection({
  skill,
  examId,
  studentId,
  items,
  test,
  className,
}: {
  skill: ObjectiveSkill;
  examId: string;
  studentId: string;
  items: GradeItem[];
  test: ExamReadingTest | ExamListeningTest | null;
  className?: string;
}) {
  const rows = mistakesByKind(items, kindResolver(test));
  if (!rows.length) return null;
  const [catalog, done] = await Promise.all([
    skill === "READING" ? listReadingExams() : listListeningExams(),
    doneContentKeys(studentId, skill),
  ]);
  const lines: MistakeLine[] = rows.map((r) => ({
    ...r,
    pick: pickPracticePart({ kind: r.kind, skill, currentTestId: examId, catalog, done }),
  }));
  return <MistakesByTypeCard skill={skill} lines={lines} className={className} />;
}
