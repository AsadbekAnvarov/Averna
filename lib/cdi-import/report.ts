/** The import report: one row per source file (JSON and Markdown). Never contains keys, texts or local paths. */

import type { BoundaryCandidate } from "./boundaries";
import type { ConvertIssue } from "./groups";
import type { SourceResult } from "./pipeline";

export interface ReportRow {
  file: string;
  id: string | null;
  status: "manifest" | "excluded";
  parts: number;
  questions: number;
  kinds: string[];
  durationMs: number | null;
  duration: string | null;
  keyFirst: string | null;
  keyLast: string | null;
  missed: number[];
  candidates: (BoundaryCandidate | null)[] | null;
  contentHints: number;
  media: { path: string; bytes: number }[];
  warnings: string[];
  errors: string[];
}

export interface Report {
  batch: "volume-10";
  rows: ReportRow[];
  totals: { files: number; inManifest: number; excluded: number; mediaBytes: number };
}

export function clock(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${rest}`;
}

function issueText(i: ConvertIssue): string {
  return `${i.questions?.length ? `Q${i.questions.join(",")}: ` : ""}${i.message}`;
}

export function buildReport(results: SourceResult[]): Report {
  const rows = results
    .map((r): ReportRow => ({
      file: r.file,
      id: r.meta?.id ?? null,
      status: r.included ? "manifest" : "excluded",
      parts: r.parts,
      questions: r.questions,
      kinds: r.kinds,
      durationMs: r.audio?.durationMs ?? null,
      duration: r.audio ? clock(r.audio.durationMs) : null,
      keyFirst: r.key ? `${r.key.first}/${r.key.total}` : null,
      keyLast: r.key ? `${r.key.last}/${r.key.total}` : null,
      missed: r.key?.missed ?? [],
      candidates: r.candidates,
      contentHints: r.contentHints,
      media: r.media.map((m) => ({ path: m.path, bytes: m.bytes.length })),
      warnings: r.warnings.map(issueText),
      errors: r.errors.map(issueText),
    }))
    .sort((a, b) => (a.id ?? a.file).localeCompare(b.id ?? b.file));
  const inManifest = rows.filter((r) => r.status === "manifest").length;
  return {
    batch: "volume-10",
    rows,
    totals: { files: rows.length, inManifest, excluded: rows.length - inManifest, mediaBytes: rows.reduce((n, r) => n + r.media.reduce((m, x) => m + x.bytes, 0), 0) },
  };
}

function candidatesText(c: (BoundaryCandidate | null)[] | null): string {
  if (!c) return "—";
  return c.map((x, i) => (x ? `${i + 1}: ${clock(x.ms)} (${x.method})` : `${i + 1}: —`)).join("; ");
}

export function reportMarkdown(r: Report): string {
  const lines = [
    "# Volume 10 import report",
    "",
    `${r.totals.files} files · ${r.totals.inManifest} in the manifest · ${r.totals.excluded} excluded · media ${(r.totals.mediaBytes / 1024 / 1024).toFixed(1)} MB`,
    "",
    "| Paper | File | Result | Parts / questions | Recording | Key (first / last) | Boundary candidates | L1 hints on content |",
    "|---|---|---|---|---|---|---|---|",
    ...r.rows.map(
      (x) =>
        `| ${x.id ?? "—"} | ${x.file} | ${x.status === "manifest" ? "in manifest" : "**excluded**"} | ${x.parts} / ${x.questions} | ${x.duration ?? "—"} | ${x.keyFirst ?? "—"} / ${x.keyLast ?? "—"} | ${candidatesText(x.candidates)} | ${x.contentHints} |`,
    ),
    "",
  ];
  for (const x of r.rows) {
    if (!x.errors.length && !x.warnings.length) continue;
    lines.push(`## ${x.id ?? x.file}`, "");
    for (const e of x.errors) lines.push(`- Error: ${e}`);
    for (const w of x.warnings) lines.push(`- Warning: ${w}`);
    lines.push("");
  }
  return lines.join("\n");
}
