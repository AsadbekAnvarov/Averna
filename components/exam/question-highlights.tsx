"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HIGHLIGHT_COLORS, type HighlightColor } from "./exam-preferences";
import { useMockCdi } from "./mock-cdi-interface";

type Annotation = { from: number; to: number; quote: string; color: HighlightColor };
type TextRun = { node: Text; from: number; to: number };
type Registry = { highlights?: Map<string, unknown> };
type Tool = { from: number; to: number; quote: string; x: number; y: number };
const EXCLUDE = "input,textarea,select,button,option,[aria-hidden=true],[data-highlight-ignore],.sr-only";
export const questionHighlightKey = (attemptId: string) => `averna-question-hl:${attemptId}`;
export function clearQuestionHighlights(attemptId: string) {
  try { localStorage.removeItem(questionHighlightKey(attemptId)); } catch { /* Optional local exam aids. */ }
}

/** Only question copy counts towards offsets: answer values and controls never do. */
export function questionText(root: HTMLElement): { text: string; runs: TextRun[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const runs: TextRun[] = [];
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.data || node.parentElement?.closest(EXCLUDE)) continue;
    runs.push({ node, from: text.length, to: text.length + node.length });
    text += node.data;
  }
  return { text, runs };
}

export function questionRange(runs: TextRun[], from: number, to: number): Range | null {
  const first = runs.find(r => r.to > from);
  const last = runs.find(r => r.to >= to && r.from < to);
  if (!first || !last || from < 0 || to <= from) return null;
  const range = document.createRange();
  range.setStart(first.node, from - first.from);
  range.setEnd(last.node, to - last.from);
  return range;
}

/** Remove/recolour a slice without erasing neighbouring annotations. */
export function editQuestionHighlights(items: Annotation[], slice: Pick<Tool, "from" | "to">, text: string, color?: HighlightColor): Annotation[] {
  const next: Annotation[] = [];
  for (const item of items) {
    if (item.to <= slice.from || item.from >= slice.to) next.push(item);
    else {
      if (item.from < slice.from) next.push({ ...item, to: slice.from, quote: text.slice(item.from, slice.from) });
      if (item.to > slice.to) next.push({ ...item, from: slice.to, quote: text.slice(slice.to, item.to) });
    }
  }
  if (color) next.push({ from: slice.from, to: slice.to, quote: text.slice(slice.from, slice.to), color });
  return next.sort((a, b) => a.from - b.from);
}

function readAttempt(key: string): Record<string, Annotation[]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, Annotation[]>;
  } catch { return {}; }
}
function readAnnotations(key: string, scope: string): Annotation[] {
  const raw = readAttempt(key)[scope];
  if (!Array.isArray(raw)) return [];
  return raw.filter(a => a && Number.isInteger(a.from) && Number.isInteger(a.to) && a.from >= 0 && a.to > a.from && typeof a.quote === "string" && HIGHLIGHT_COLORS.some(c => c.id === a.color));
}

/** Mock already owns its selection/notes toolbar; never install a competing one. */
export function QuestionHighlights(props: { attemptId: string; scope: string; children: ReactNode }) {
  const mock = useMockCdi();
  return mock ? <>{props.children}</> : <PracticeQuestionHighlights key={`${props.attemptId}:${props.scope}`} {...props} />;
}

function PracticeQuestionHighlights({ attemptId, scope, children }: { attemptId: string; scope: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const unique = useId().replace(/[^a-zA-Z0-9]/g, "");
  const prefix = `averna-question-${unique}`;
  const key = questionHighlightKey(attemptId);
  const [items, setItems] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [message, setMessage] = useState("");
  const pressing = useRef(false);
  const dragging = useRef(false);
  const touch = useRef(false);

  useEffect(() => {
    setItems(readAnnotations(key, scope));
    try {
      const saved = localStorage.getItem("averna-highlight-color");
      if (HIGHLIGHT_COLORS.some(c => c.id === saved)) setColor(saved as HighlightColor);
    } catch { /* Keep default. */ }
  }, [key, scope]);

  useEffect(() => {
    const api = typeof CSS !== "undefined" ? (CSS as typeof CSS & Registry).highlights : undefined;
    const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!api || !Highlight || !root.current) return;
    const paint = () => {
      if (!root.current) return;
      const { text, runs } = questionText(root.current);
      for (const c of HIGHLIGHT_COLORS) {
        const ranges = items.filter(a => a.color === c.id && text.slice(a.from, a.to) === a.quote)
          .map(a => questionRange(runs, a.from, a.to)).filter((r): r is Range => !!r);
        api.set(`${prefix}-${c.id}`, new Highlight(...ranges));
      }
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(root.current, { subtree: true, childList: true, characterData: true });
    return () => { observer.disconnect(); for (const c of HIGHLIGHT_COLORS) api.delete(`${prefix}-${c.id}`); };
  }, [items, prefix]);

  const select = useCallback(() => {
    if (pressing.current || dragging.current) return;
    const el = root.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.isCollapsed || !sel.rangeCount) {
      if (!toolbar.current?.contains(document.activeElement)) setTool(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const ignored = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? n as Element : n.parentElement)?.closest(EXCLUDE);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer) || ignored(range.startContainer) || ignored(range.endContainer)) { setTool(null); return; }
    const { text, runs } = questionText(el);
    const included = runs.filter(r => range.intersectsNode(r.node));
    const first = included[0], last = included[included.length - 1];
    if (!first || !last) { setTool(null); return; }
    let from = first.from + (range.startContainer === first.node ? range.startOffset : 0);
    let to = last.from + (range.endContainer === last.node ? range.endOffset : last.node.length);
    while (from < to && /\s/.test(text[from])) from++;
    while (to > from && /\s/.test(text[to - 1])) to--;
    if (to <= from || to - from > 10000) { setTool(null); return; }
    const rect = range.getBoundingClientRect();
    // Two compact rows; clamp the whole toolbar, not just its anchor.
    const width = Math.min(312, window.innerWidth - 16);
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
    const y = Math.max(8, Math.min(window.innerHeight - 118, rect.bottom + (touch.current ? 30 : 8)));
    try {
      const saved = localStorage.getItem("averna-highlight-color");
      if (HIGHLIGHT_COLORS.some(c => c.id === saved)) setColor(saved as HighlightColor);
    } catch { /* Storage is optional. */ }
    setTool({ from, to, quote: text.slice(from, to), x, y });
  }, []);

  useEffect(() => {
    let timer = 0;
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(select, 100); };
    const down = (e: PointerEvent) => {
      touch.current = e.pointerType === "touch" || e.pointerType === "pen";
      pressing.current = !!toolbar.current?.contains(e.target as Node);
      if (!pressing.current) { dragging.current = e.pointerType === "mouse" && e.button === 0; setTool(null); }
    };
    const up = () => { dragging.current = false; if (!pressing.current) schedule(); };
    const dismiss = () => { if (!pressing.current) setTool(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { pressing.current = false; setTool(null); } };
    const blur = () => { dragging.current = false; pressing.current = false; setTool(null); };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", blur, true);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", blur);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", blur, true);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", blur);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [select]);

  const apply = (remove = false) => {
    if (!tool || !root.current) return;
    if (typeof CSS === "undefined" || !(CSS as typeof CSS & Registry).highlights || !(window as unknown as { Highlight?: unknown }).Highlight) {
      setMessage("Highlighting is unavailable in this browser. Please use an up-to-date browser.");
      pressing.current = false;
      setTool(null);
      return;
    }
    const { text } = questionText(root.current);
    if (text.slice(tool.from, tool.to) !== tool.quote) { setTool(null); return; }
    const next = editQuestionHighlights(items, tool, text, remove ? undefined : color);
    setItems(next);
    try {
      const saved = readAttempt(key);
      if (next.length) saved[scope] = next; else delete saved[scope];
      if (Object.keys(saved).length) localStorage.setItem(key, JSON.stringify(saved)); else localStorage.removeItem(key);
    } catch { /* Private mode: retain annotations in memory. */ }
    window.getSelection()?.removeAllRanges();
    pressing.current = false;
    setTool(null);
    setMessage(remove ? "Highlight removed" : "Highlight added");
  };

  return <>
    <style>{HIGHLIGHT_COLORS.map(c => `::highlight(${prefix}-${c.id}){background-color:${c.fill};color:inherit;}`).join("\n")}</style>
    <div ref={root} className="select-text selection:bg-averna-cyan/30">{children}</div>
    {tool && createPortal(<div ref={toolbar} role="toolbar" aria-label="Question highlight tools"
      className="fixed z-[120] rounded-xl border border-white/20 bg-exam-bar p-1 text-gray-100 shadow-xl"
      style={{ left: tool.x, top: tool.y, width: "min(312px, calc(100vw - 16px))" }}
      onPointerDown={e => { pressing.current = true; e.preventDefault(); }} onMouseDown={e => e.preventDefault()}>
      <div className="flex items-center gap-1" role="group" aria-label="Highlight color">
        {HIGHLIGHT_COLORS.map(c => <button key={c.id} type="button" aria-label={`${c.label} highlight`} aria-pressed={color === c.id}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon"
          onClick={() => { setColor(c.id); pressing.current = false; try { localStorage.setItem("averna-highlight-color", c.id); } catch {} }}>
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-sm" style={{ backgroundColor: c.fill }}>{color === c.id ? "✓" : ""}</span>
        </button>)}
      </div>
      <div className="mt-1 flex gap-1">
        <button type="button" className="min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-averna-neon" onClick={() => apply()}>Highlight</button>
        {items.some(a => a.from < tool.to && a.to > tool.from) && <button type="button" className="min-h-[44px] flex-1 rounded-lg px-3 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-averna-neon" onClick={() => apply(true)}>Remove</button>}
        <button type="button" aria-label="Close highlight tools" className="min-h-[44px] rounded-lg px-3 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-averna-neon" onClick={() => { pressing.current = false; setTool(null); }}>Close</button>
      </div>
    </div>, document.body)}
    <span className="sr-only" role="status">{message}</span>
  </>;
}
