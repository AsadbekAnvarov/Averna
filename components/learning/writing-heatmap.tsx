"use client";

import { useMemo, useState } from "react";

export interface HeatmapIssue {
  text: string;
  type: string;
  suggestion: string;
}

const TYPE_META: Record<string, { mark: string; dot: string; label: string }> = {
  grammar: { mark: "bg-red-500/15 decoration-red-400", dot: "bg-red-400", label: "Grammar" },
  spelling: { mark: "bg-red-500/15 decoration-red-400", dot: "bg-red-400", label: "Spelling" },
  vocabulary: { mark: "bg-amber-400/20 decoration-amber-400", dot: "bg-amber-400", label: "Vocabulary" },
  style: { mark: "bg-amber-400/20 decoration-amber-400", dot: "bg-amber-400", label: "Style" },
  cohesion: { mark: "bg-averna-cyan/20 decoration-averna-cyan", dot: "bg-averna-cyan", label: "Cohesion" },
  punctuation: { mark: "bg-averna-purple/20 decoration-averna-purple", dot: "bg-averna-purple", label: "Punctuation" },
  good: { mark: "bg-averna-neon/20 decoration-averna-neon", dot: "bg-averna-neon", label: "Strong" },
};
const DEFAULT_META = { mark: "bg-white/15 decoration-gray-400", dot: "bg-gray-400", label: "Note" };
const meta = (t: string) => TYPE_META[(t || "").toLowerCase()] ?? DEFAULT_META;

type Segment = { text: string; markIndex?: number; issue?: HeatmapIssue };

/**
 * Renders the student's essay with the detected issues highlighted inline
 * (colour-coded by type, with a tappable tip for each). Matching is done by
 * locating each issue's exact snippet in the essay — issues that can't be
 * safely located (truncated snippets, single letters) are skipped here and
 * still shown in the detailed list below the heatmap.
 */
export function WritingHeatmap({ essay, issues }: { essay: string; issues: HeatmapIssue[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  const { segments, legendTypes } = useMemo(() => {
    const text = essay ?? "";
    const marks: { start: number; end: number; issue: HeatmapIssue }[] = [];
    const used: [number, number][] = [];

    (issues ?? []).forEach((issue) => {
      const t = (issue.text || "").trim();
      if (t.length < 3 || t.endsWith("…") || t.endsWith("...")) return;
      const hay = text.toLowerCase();
      const needle = t.toLowerCase();
      let from = 0;
      while (from <= hay.length) {
        const idx = hay.indexOf(needle, from);
        if (idx === -1) break;
        const end = idx + t.length;
        if (!used.some(([s, e]) => idx < e && end > s)) {
          marks.push({ start: idx, end, issue });
          used.push([idx, end]);
          break;
        }
        from = idx + 1;
      }
    });

    marks.sort((a, b) => a.start - b.start);

    const segs: Segment[] = [];
    let cursor = 0;
    marks.forEach((m, mi) => {
      if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start) });
      segs.push({ text: text.slice(m.start, m.end), markIndex: mi, issue: m.issue });
      cursor = m.end;
    });
    if (cursor < text.length) segs.push({ text: text.slice(cursor) });

    const legend = Array.from(new Set(marks.map((m) => (m.issue.type || "").toLowerCase())));
    return { segments: segs, legendTypes: legend };
  }, [essay, issues]);

  if (!essay) return null;

  const selectedIssue =
    selected !== null ? segments.find((s) => s.markIndex === selected)?.issue ?? null : null;

  return (
    <div>
      {legendTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
          {legendTypes.map((t) => {
            const m = meta(t);
            return (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.label}
              </span>
            );
          })}
          <span className="text-xs text-gray-500">· tap a highlight for a tip</span>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">
          No inline highlights to show — see the detailed notes below.
        </p>
      )}

      <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-200">
        {segments.map((seg, i) =>
          seg.issue ? (
            <mark
              key={i}
              onClick={() => setSelected(seg.markIndex === selected ? null : seg.markIndex ?? null)}
              title={seg.issue.suggestion}
              className={`cursor-pointer rounded px-0.5 underline decoration-2 underline-offset-2 bg-transparent transition-all ${meta(seg.issue.type).mark} ${
                selected === seg.markIndex ? "ring-2 ring-white/50" : ""
              }`}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>

      {selectedIssue && (
        <div className="mt-3 flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 p-3 animate-fade-in">
          <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${meta(selectedIssue.type).dot}`} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{meta(selectedIssue.type).label}</p>
            <p className="text-sm text-white break-words">&ldquo;{selectedIssue.text}&rdquo;</p>
            <p className="text-sm text-gray-300 mt-0.5 break-words">{selectedIssue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}
