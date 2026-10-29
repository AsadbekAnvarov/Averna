/**
 * Source transcripts → ScriptLine[] per part, with the source's answer
 * markers kept as `marks` (question numbers + [start, end) in the line):
 * - `<mark data-questions="13 14">…</mark>` (tests 2–6): the marked text;
 * - "[Qn → x]" (test 1): the nearest earlier occurrence of x in the line
 *   (normalizeAnswer comparison), else the sentence holding the marker.
 * Speaker labels stay as in the source; the reply text excludes the label,
 * the question tags and the markers.
 */

import { normalizeAnswer } from "../ielts/grading";
import type { ScriptLine } from "../ielts/types";
import { attr, children, cleanText, findAll, hasClass, isElement, select, type HtmlDocument, type HtmlNode } from "./dom";
import { collapse } from "./text";

const START = "\uE000";
const END = "\uE001";

export interface TranscriptPart {
  /** The section heading of the transcript (the part's topic), when it has one. */
  topic: string | null;
  lines: ScriptLine[];
}

function speakerLabel(t: string): string {
  return collapse(t).replace(/\s*:\s*$/, "");
}

/** Text with mark sentinels → { text, marks } with offsets in the collapsed text. */
function withMarks(raw: string, markNumbers: number[][]): { text: string; marks: { n: number[]; start: number; end: number }[] } {
  let text = "";
  const marks: { n: number[]; start: number; end: number }[] = [];
  let k = 0;
  let open = -1;
  for (const ch of raw) {
    if (ch === START) open = text.length;
    else if (ch === END) {
      let s = open;
      let e = text.length;
      while (s < e && text[s] === " ") s++;
      while (e > s && text[e - 1] === " ") e--;
      if (open >= 0 && e > s) marks.push({ n: markNumbers[k], start: s, end: e });
      k++;
      open = -1;
    } else if (/\s/.test(ch)) {
      // Collapse whitespace as it is read, so offsets never need remapping.
      if (text && !text.endsWith(" ")) text += " ";
    } else text += ch;
  }
  if (text.endsWith(" ")) text = text.slice(0, -1);
  return { text, marks: marks.map((m) => ({ ...m, end: Math.min(m.end, text.length) })).filter((m) => m.end > m.start) };
}

function questionNumbers(v: string | null): number[] {
  return (v ?? "").split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

/** Tests 2–6: `.transcript-section[data-section]` with one paragraph per reply. */
function sectionTranscripts(doc: HtmlDocument): TranscriptPart[] | null {
  const sections = select(doc, { cls: "transcript-section" }).filter((s) => attr(s, "data-section"));
  if (!sections.length) return null;
  const out: TranscriptPart[] = [];
  for (const sec of sections.sort((a, b) => Number(attr(a, "data-section")) - Number(attr(b, "data-section")))) {
    const h = findAll(sec, (e) => /^h[1-4]$/.test(e.tagName))[0];
    const lines: ScriptLine[] = [];
    for (const p of findAll(sec, (e) => e.tagName === "p")) {
      if (hasClass(p, "review-note")) continue;
      const sp = findAll(p, (e) => hasClass(e, "speaker"))[0];
      const markNums: number[][] = [];
      let raw = "";
      const walk = (n: HtmlNode) => {
        if ((n as { nodeName: string }).nodeName === "#text") {
          raw += (n as unknown as { value: string }).value;
          return;
        }
        if (!isElement(n) || n === sp || hasClass(n, "transcript-q-tag") || n.tagName === "button" || n.tagName === "script") return;
        if (n.tagName === "mark" || hasClass(n, "transcript-answer-hit")) {
          markNums.push(questionNumbers(attr(n, "data-questions")));
          raw += START;
          for (const c of children(n)) walk(c);
          raw += END;
          return;
        }
        if (n.tagName === "br") raw += " ";
        for (const c of children(n)) walk(c);
      };
      for (const c of children(p)) walk(c);
      const { text, marks } = withMarks(raw, markNums);
      if (!text) continue;
      const line: ScriptLine = { speaker: sp ? speakerLabel(cleanText(sp)) || "Narrator" : "Narrator", text };
      if (marks.length) line.marks = marks;
      lines.push(line);
    }
    out.push({ topic: h ? cleanText(h) : null, lines });
  }
  return out;
}

const Q_MARK = /\[\s*Q\s*(\d{1,2}(?:\s*[,&/]\s*\d{1,2})*)\s*(?:→|->|=>|:)\s*([^\]]*)\]/g;

function sentenceAround(text: string, at: number): [number, number] {
  let s = at;
  while (s > 0 && !/[.!?]/.test(text[s - 1])) s--;
  let e = at;
  while (e < text.length && !/[.!?]/.test(text[e])) e++;
  if (e < text.length) e++;
  while (s < e && text[s] === " ") s++;
  return [s, e];
}

/** Test 1: `#transcriptData div[data-part]`, one reply per line ("Name: text [Qn → x]"). */
function lineTranscripts(doc: HtmlDocument): TranscriptPart[] | null {
  const parts = select(doc, { tag: "div", attr: "data-part" }).filter((d) => {
    let p: HtmlNode | undefined = d;
    while (p) {
      if (isElement(p) && attr(p, "id") === "transcriptData") return true;
      p = (p as unknown as { parentNode?: HtmlNode }).parentNode;
    }
    return false;
  });
  if (!parts.length) return null;
  const out: TranscriptPart[] = [];
  for (const div of parts.sort((a, b) => Number(attr(a, "data-part")) - Number(attr(b, "data-part")))) {
    let topic: string | null = null;
    const raw: string[] = [""];
    for (const c of children(div)) {
      if (isElement(c) && c.tagName === "strong" && /^SECTION\s+\d/i.test(cleanText(c)) && !topic) {
        topic = cleanText(c).replace(/^SECTION\s+\d+\s*[—–-]\s*/i, "");
        continue;
      }
      if (isElement(c) && c.tagName === "br") raw.push("");
      else raw[raw.length - 1] += isElement(c) ? cleanText(c) : (c as unknown as { value?: string }).value ?? "";
    }
    const lines: ScriptLine[] = [];
    for (const r of raw) {
      let t = collapse(r);
      if (!t) continue;
      const m = /^([A-Z][\w .'’-]{0,30}?):\s+/.exec(t);
      const speaker = m ? m[1] : "Narrator";
      if (m) t = t.slice(m[0].length);
      // Remove the markers, remembering where they were and what they point at.
      const found: { at: number; n: number[]; answer: string }[] = [];
      let text = "";
      let last = 0;
      for (const mm of Array.from(t.matchAll(Q_MARK))) {
        text += t.slice(last, mm.index);
        found.push({ at: text.length, n: mm[1].split(/[,&/]/).map((x) => Number(x.trim())), answer: collapse(mm[2]) });
        last = (mm.index ?? 0) + mm[0].length;
      }
      text += t.slice(last);
      text = collapse(text.replace(/\s+([,.;:!?])/g, "$1"));
      const marks: { n: number[]; start: number; end: number }[] = [];
      for (const f of found) {
        const at = Math.min(f.at, text.length);
        const target = normalizeAnswer(f.answer);
        let best: [number, number] | null = null;
        // A letter answer ("[Q22 → A]") isn't spoken: mark the sentence instead.
        if (target && target.length > 1) {
          // The nearest earlier occurrence of the answer (word boundaries, normalised comparison).
          const words = text.slice(0, at);
          for (let s = words.length - 1; s >= 0; s--) {
            if (s > 0 && /\w/.test(words[s - 1])) continue;
            for (let e = s + 1; e <= words.length; e++) {
              if (e < words.length && /\w/.test(words[e])) continue;
              const cand = normalizeAnswer(words.slice(s, e));
              if (cand === target) {
                best = [s, e];
                break;
              }
              if (cand.length > target.length + 4) break;
            }
            if (best) break;
          }
        }
        const [s, e] = best ?? sentenceAround(text, Math.max(0, at - 1));
        if (e > s) marks.push({ n: f.n, start: s, end: e });
      }
      const line: ScriptLine = { speaker, text };
      if (marks.length) line.marks = marks;
      lines.push(line);
    }
    out.push({ topic, lines });
  }
  return out;
}

export function convertTranscript(doc: HtmlDocument): TranscriptPart[] {
  return sectionTranscripts(doc) ?? lineTranscripts(doc) ?? [];
}

/** Question numbers with at least one marker. */
export function markedQuestions(parts: TranscriptPart[]): Set<number> {
  const out = new Set<number>();
  for (const p of parts) for (const l of p.lines) for (const m of l.marks ?? []) m.n.forEach((n) => out.add(n));
  return out;
}
