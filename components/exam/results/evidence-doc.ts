import { partWordCount } from "@/lib/ielts/format";
import type { ListeningPart, ReadingPart } from "@/lib/ielts/types";

/**
 * The text shown beside a part's answers on the result page (passage or
 * transcript), in the shape the client EvidenceScope renders. Indices match
 * lib/review/evidence (paragraph index / script line index). Pure.
 */
export type EvidenceDoc =
  | { kind: "passage"; title: string; subtitle?: string; words?: number; paragraphs: { label?: string; text: string }[] }
  | { kind: "transcript"; context?: string; lines: { index: number; speaker: string; text: string; narrator: boolean }[] };

const isNarrator = (speaker: string) => speaker.trim().toLowerCase() === "narrator";

export function evidenceDoc(part: ReadingPart | ListeningPart): EvidenceDoc {
  if ("paragraphs" in part) {
    return {
      kind: "passage",
      title: part.title,
      ...(part.subtitle ? { subtitle: part.subtitle } : {}),
      words: partWordCount(part),
      paragraphs: part.paragraphs.map((p) => ({ ...(p.label ? { label: p.label } : {}), text: p.text ?? "" })),
    };
  }
  return {
    kind: "transcript",
    ...(part.context ? { context: part.context } : {}),
    lines: part.script
      .map((l, index) => ({ index, speaker: l?.speaker ?? "", text: typeof l?.text === "string" ? l.text : "", narrator: isNarrator(l?.speaker ?? "") }))
      .filter((l) => l.text.trim()),
  };
}

export function docHasText(doc: EvidenceDoc): boolean {
  return doc.kind === "passage" ? doc.paragraphs.some((p) => p.text.trim()) : doc.lines.length > 0;
}
