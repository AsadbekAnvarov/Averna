/** Report and block copy and rules (docs/peer-speaking.md, Phase C). Pure and client-safe. */

export const REPORT_REASONS = ["inappropriate", "harassment", "not-speaking-english", "no-show", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  inappropriate: "Inappropriate behaviour or language",
  harassment: "Harassment or bullying",
  "not-speaking-english": "Didn't speak English",
  "no-show": "Didn't join or didn't talk",
  other: "Something else",
};

export const isReportReason = (v: unknown): v is ReportReason => typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);

export const REPORT_NOTE_MAX = 300;
/** Reports a student may send per day. */
export const REPORTS_PER_DAY = 5;

export const SAFETY_COPY = {
  block: "Blocked students are never matched with you again. Blocking also ends this session.",
  report: "Reports go to your teachers. Two open reports pause a student's peer speaking until a teacher reviews them.",
} as const;
