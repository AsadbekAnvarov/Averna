/**
 * Alt text for a Writing Task 1 picture (pure; safe in client components).
 *
 * The prompt's opening sentence already describes the visual ("The charts below
 * illustrate the percentage of time…"), so it makes a better summary than the
 * title ("CDI Writing 01 · Task 1: Chart"). Falls back to the title.
 */
export function task1ImageAlt(p: { title: string; prompt: string }): string {
  const first = String(p.prompt || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .find(Boolean);
  const sentence = first ? (/^(.+?[.!?])(\s|$)/.exec(first)?.[1] ?? first) : "";
  const text = sentence || String(p.title || "").trim();
  const capped = text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text;
  return capped ? `Task 1 visual: ${capped}` : "Task 1 visual";
}
