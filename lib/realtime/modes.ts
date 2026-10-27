/**
 * Live speaking partner (docs/elegance-roadmap.md, idea 3): the three ways to talk.
 * Pure and client-safe — the setup screen, the prompt builder and the routes share it.
 */

export type LiveMode = "casual" | "part1" | "part3";

export interface LiveModeInfo {
  id: LiveMode;
  label: string;
  /** One line under the label on the setup screen. */
  hint: string;
}

export const LIVE_MODES: readonly LiveModeInfo[] = [
  { id: "casual", label: "Casual chat", hint: "A relaxed talk about everyday things, like with a classmate." },
  { id: "part1", label: "IELTS Part 1", hint: "Short questions about you and familiar topics." },
  { id: "part3", label: "Part 3 discussion", hint: "Bigger questions: give opinions, reasons and examples." },
];

/** The topic id that lets the server pick one. */
export const SURPRISE_TOPIC = "surprise";

export const isLiveMode = (x: unknown): x is LiveMode => x === "casual" || x === "part1" || x === "part3";

export const liveModeLabel = (mode: LiveMode): string => LIVE_MODES.find((m) => m.id === mode)?.label ?? "Casual chat";
