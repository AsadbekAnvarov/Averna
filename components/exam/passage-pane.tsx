"use client";

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eraser, Highlighter, Search } from "lucide-react";
import type { ExamParagraph } from "@/lib/ielts/types";
import { cn } from "@/lib/utils";
import { normalizeWord, sentenceAround } from "@/lib/dictionary-core";
import { rangeFromOffsets, rangeRect } from "@/components/dictionary/dom";
import { WordPopover, type LookupRequest } from "@/components/dictionary/word-popover";

/**
 * Left pane of the CD-IELTS Reading runner: the passage, typeset for long-form
 * reading, with exam-style highlighting.
 *
 * Highlights are data, never DOM surgery: every paragraph keeps a sorted list
 * of [start, end) character offsets into its own text, persisted per attempt
 * in localStorage (`averna-exam-hl:${attemptId}`) and rendered by React as
 * <mark>. A selection that runs across several paragraphs is split per
 * paragraph. Mouse, keyboard and touch selections all go through
 * `selectionchange`, so long-press + handles on phones works too.
 *
 * Font size is inherited from the exam shell (A−/A+): body text sets no
 * text-size classes and spacing is in em, so everything scales together.
 * Memoised — typing an answer never re-renders the passage.
 */

/** [start, end) character offsets into one paragraph's text. */
export type HighlightSpan = [number, number];
/** passage id → paragraph index → spans (sorted, non-overlapping). */
export type HighlightStore = Record<string, Record<string, HighlightSpan[]>>;

export interface PassageSource {
  id: string;
  title: string;
  subtitle?: string;
  paragraphs: ExamParagraph[];
}

export interface PassagePaneProps {
  passage: PassageSource;
  /** Small caps label above the title, e.g. "Reading Passage 2". */
  label?: string;
  /** Exam rubric, e.g. "You should spend about 20 minutes on Questions 14–26, which are based on Reading Passage 2 below." */
  intro?: string;
  /** Highlights are stored per attempt. */
  attemptId: string;
  /**
   * Practice only: the in-text dictionary — "Look up" in the selection toolbar
   * for 1–3 words (also on a tapped highlight). A double-click only selects the
   * word, so the toolbar offers Highlight and Look up side by side. Never in
   * the mock exam.
   */
  lookup?: boolean;
}

export const highlightStorageKey = (attemptId: string) => `averna-exam-hl:${attemptId}`;

/** Drop an attempt's highlights (call after a successful submit). */
export function clearPassageHighlights(attemptId: string) {
  try {
    window.localStorage.removeItem(highlightStorageKey(attemptId));
  } catch {
    /* storage unavailable */
  }
}

/** Nearest scrollable ancestor (the exam shell's pane). */
export function findScrollParent(el: Element | null): HTMLElement | null {
  if (typeof window === "undefined") return null;
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const oy = window.getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return node;
    node = node.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pure span helpers
// ---------------------------------------------------------------------------

const EMPTY_SPANS: HighlightSpan[] = [];
const EMPTY_PART: Record<string, HighlightSpan[]> = {};

/** Clamp to [0, len], drop empty spans, sort, and merge overlapping / touching ones. */
export function normalizeSpans(spans: HighlightSpan[], len: number): HighlightSpan[] {
  const clamped = spans
    .map(([s, e]): HighlightSpan => [Math.max(0, Math.min(len, Math.floor(s))), Math.max(0, Math.min(len, Math.floor(e)))])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: HighlightSpan[] = [];
  for (const [s, e] of clamped) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Remove [s, e) from a span list (splitting spans that straddle it). */
export function subtractSpan(spans: HighlightSpan[], [s, e]: HighlightSpan): HighlightSpan[] {
  const out: HighlightSpan[] = [];
  for (const [a, b] of spans) {
    if (b <= s || a >= e) {
      out.push([a, b]);
      continue;
    }
    if (a < s) out.push([a, s]);
    if (b > e) out.push([e, b]);
  }
  return out;
}

/** Characters of [s, e) already covered by (normalised) spans. */
function coveredLength(spans: HighlightSpan[], [s, e]: HighlightSpan): number {
  let n = 0;
  for (const [a, b] of spans) n += Math.max(0, Math.min(b, e) - Math.max(a, s));
  return n;
}

function isSpan(x: unknown): x is HighlightSpan {
  return Array.isArray(x) && x.length === 2 && Number.isInteger(x[0]) && Number.isInteger(x[1]) && x[0] >= 0 && x[1] > x[0];
}

function readStore(key: string): HighlightStore {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { parts?: unknown } | null;
    const parts = parsed && typeof parsed === "object" ? parsed.parts : null;
    if (!parts || typeof parts !== "object") return {};
    const out: HighlightStore = {};
    for (const [pid, paras] of Object.entries(parts as Record<string, unknown>)) {
      if (!paras || typeof paras !== "object") continue;
      const clean: Record<string, HighlightSpan[]> = {};
      for (const [idx, spans] of Object.entries(paras as Record<string, unknown>)) {
        if (!Array.isArray(spans)) continue;
        const ok = spans.filter(isSpan).map(([s, e]): HighlightSpan => [s, e]);
        if (ok.length) clean[idx] = ok;
      }
      if (Object.keys(clean).length) out[pid] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(key: string, store: HighlightStore) {
  try {
    if (Object.keys(store).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ v: 1, parts: store }));
  } catch {
    /* storage full / private mode — highlights still work for this session */
  }
}

// ---------------------------------------------------------------------------
// Selection → per-paragraph offsets
// ---------------------------------------------------------------------------

/** One paragraph's slice of a selection: paragraph index + [s, e) offsets. */
export interface Segment {
  p: number;
  s: number;
  e: number;
}

interface ToolState {
  /** "selection" follows the live text selection; "mark" = the student tapped an existing highlight. */
  kind: "selection" | "mark";
  segments: Segment[];
  canHighlight: boolean;
  canRemove: boolean;
  /** Anchor point in root (article) coordinates. */
  x: number;
  y: number;
  placement: "above" | "below";
  rootWidth: number;
}

/** Offset of a DOM boundary point inside paragraph element `el` (clamped to [0, len]). */
function pointOffset(el: HTMLElement, node: Node, offset: number, len: number): number | null {
  try {
    const within = document.createRange();
    within.selectNodeContents(el);
    const cmp = within.comparePoint(node, offset);
    if (cmp < 0) return 0;
    if (cmp > 0) return len;
    const before = document.createRange();
    before.setStart(el, 0);
    before.setEnd(node, offset);
    return Math.max(0, Math.min(len, before.toString().length));
  } catch {
    return null;
  }
}

const WS = /\s/;

/**
 * Split a DOM range into per-paragraph offsets. `textEl` holds the paragraph
 * elements (data-para={index}), whose text content is exactly
 * `paragraphs[index].text` (labels live outside them). The range is first
 * clipped to `textEl`, so a selection may start in the title or run past the
 * passage; surrounding whitespace is trimmed off each slice. Returns null when
 * nothing selectable is covered — never throws.
 */
export function selectionSegments(
  textEl: HTMLElement,
  range: Range,
  paragraphs: { text: string }[]
): { segments: Segment[]; clipped: Range } | null {
  try {
    const bounds = document.createRange();
    bounds.selectNodeContents(textEl);
    const r = range.cloneRange();
    // Setting a start after the end (or vice versa) collapses the range → "no overlap".
    if (r.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) r.setStart(bounds.startContainer, bounds.startOffset);
    if (r.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) r.setEnd(bounds.endContainer, bounds.endOffset);
    if (r.collapsed) return null;

    const segments: Segment[] = [];
    textEl.querySelectorAll<HTMLElement>("[data-para]").forEach((el) => {
      const p = Number(el.dataset.para);
      const text = paragraphs[p]?.text ?? "";
      let s = pointOffset(el, r.startContainer, r.startOffset, text.length);
      let e = pointOffset(el, r.endContainer, r.endOffset, text.length);
      if (s == null || e == null) return;
      while (s < e && WS.test(text[s])) s++;
      while (e > s && WS.test(text[e - 1])) e--;
      if (e > s) segments.push({ p, s, e });
    });
    return segments.length ? { segments, clipped: r } : null;
  } catch {
    return null; // never let an exotic selection crash the exam
  }
}

const TOOLBAR_H = 56;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ---------------------------------------------------------------------------
// Paragraph
// ---------------------------------------------------------------------------

export interface Piece {
  s: number;
  e: number;
  mark: boolean;
}

/** Plain / highlighted runs of one paragraph, in order. */
export function buildPieces(text: string, spans: HighlightSpan[]): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const [s, e] of normalizeSpans(spans, text.length)) {
    if (s > at) out.push({ s: at, e: s, mark: false });
    out.push({ s, e, mark: true });
    at = e;
  }
  if (at < text.length) out.push({ s: at, e: text.length, mark: false });
  return out;
}

interface ParagraphProps {
  index: number;
  text: string;
  label?: string;
  withLabels: boolean;
  spans: HighlightSpan[];
}

function ParagraphImpl({ index, text, label, withLabels, spans }: ParagraphProps) {
  const pieces = useMemo(() => buildPieces(text, spans), [text, spans]);
  return (
    <div className="flex gap-[0.9em]">
      {withLabels && (
        <span className="w-[1.3em] shrink-0 select-none font-bold text-averna-neon/90" aria-hidden={label ? undefined : true}>
          {label && (
            <>
              <span className="sr-only">Paragraph </span>
              {label}
            </>
          )}
        </span>
      )}
      <p data-para={index} className="min-w-0 flex-1 whitespace-pre-line break-words">
        {pieces.map((pc: Piece) =>
          pc.mark ? (
            <mark
              key={`m${pc.s}`}
              data-p={index}
              data-s={pc.s}
              data-e={pc.e}
              className="cursor-pointer rounded-[0.2em] bg-amber-300/25 text-amber-50 box-decoration-clone transition-colors hover:bg-amber-300/35 motion-reduce:transition-none"
            >
              {text.slice(pc.s, pc.e)}
            </mark>
          ) : (
            <Fragment key={`t${pc.s}`}>{text.slice(pc.s, pc.e)}</Fragment>
          )
        )}
      </p>
    </div>
  );
}

const Paragraph = memo(ParagraphImpl);

// ---------------------------------------------------------------------------
// Pane
// ---------------------------------------------------------------------------

function PassagePaneImpl({ passage, label, intro, attemptId, lookup = false }: PassagePaneProps) {
  const storageKey = highlightStorageKey(attemptId);
  const [store, setStore] = useState<HighlightStore>({});
  const storeRef = useRef<HighlightStore>({});
  const passageRef = useRef(passage);
  passageRef.current = passage;

  const rootRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ToolState | null>(null);
  const toolRef = useRef<ToolState | null>(null);
  toolRef.current = tool;
  const [toolbarWidth, setToolbarWidth] = useState(200);
  const [announce, setAnnounce] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  /** Last input type — touch selections get the toolbar below (clear of the native menu and handles). */
  const lastPointer = useRef<"mouse" | "touch">("mouse");
  const mouseDown = useRef(false);
  /** A press on the toolbar is in progress — don't let the collapsing selection hide it first. */
  const pressing = useRef(false);

  // ---- dictionary (practice only) ------------------------------------------
  const [look, setLook] = useState<LookupRequest | null>(null);
  const lookSeq = useRef(0);
  const lookButtonRef = useRef<HTMLButtonElement>(null);

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    const loaded = readStore(storageKey);
    storeRef.current = loaded;
    setStore(loaded);
  }, [storageKey]);

  const commit = useCallback(
    (next: HighlightStore) => {
      storeRef.current = next;
      setStore(next);
      writeStore(storageKey, next);
    },
    [storageKey]
  );

  const say = useCallback((msg: string) => {
    setAnnounce(msg);
  }, []);
  useEffect(() => {
    if (!announce) return;
    const t = window.setTimeout(() => setAnnounce(""), 1500);
    return () => window.clearTimeout(t);
  }, [announce]);

  // ---- selection → toolbar ----------------------------------------------
  const place = useCallback((first: DOMRect, last: DOMRect) => {
    const root = rootRef.current;
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    const view = findScrollParent(root)?.getBoundingClientRect();
    const viewTop = view ? view.top : 0;
    const viewBottom = view ? view.bottom : window.innerHeight;
    const touch = lastPointer.current === "touch";
    const below = touch ? 30 : 10;
    const roomAbove = first.top - viewTop >= TOOLBAR_H + 12;
    const roomBelow = viewBottom - last.bottom >= TOOLBAR_H + below;
    const placement: "above" | "below" = touch
      ? roomBelow || !roomAbove
        ? "below"
        : "above"
      : roomAbove || !roomBelow
        ? "above"
        : "below";
    const anchor = placement === "above" ? first : last;
    return {
      x: anchor.left + anchor.width / 2 - rootRect.left,
      y: (placement === "above" ? anchor.top - 8 : anchor.bottom + below) - rootRect.top,
      placement,
      rootWidth: rootRect.width,
    };
  }, []);

  const fromSelection = useCallback((): ToolState | null => {
    const textEl = textRef.current;
    if (!textEl) return null;
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
      const src = passageRef.current;
      const hit = selectionSegments(textEl, sel.getRangeAt(0), src.paragraphs);
      if (!hit) return null;
      const { segments, clipped: r } = hit;

      const spans = storeRef.current[src.id] ?? EMPTY_PART;
      let covered = 0;
      let total = 0;
      for (const g of segments) {
        covered += coveredLength(spans[g.p] ?? EMPTY_SPANS, [g.s, g.e]);
        total += g.e - g.s;
      }

      const rects = Array.from(r.getClientRects()).filter((b) => b.width > 0 && b.height > 0);
      const first = rects[0] ?? r.getBoundingClientRect();
      const last = rects[rects.length - 1] ?? first;
      const pos = place(first, last);
      if (!pos) return null;
      return { kind: "selection", segments, canHighlight: covered < total, canRemove: covered > 0, ...pos };
    } catch {
      return null; // never let an exotic selection crash the exam
    }
  }, [place]);

  useEffect(() => {
    let timer = 0;
    const run = () => {
      timer = 0;
      if (pressing.current) return;
      const next = fromSelection();
      if (next) {
        setTool(next);
        return;
      }
      const cur = toolRef.current;
      if (!cur || cur.kind === "mark") return; // tap-to-remove toolbars aren't tied to the selection
      if (toolbarRef.current?.contains(document.activeElement)) return; // keyboard user is on the toolbar
      setTool(null);
    };
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    };
    const inToolbar = (t: EventTarget | null) => !!(toolbarRef.current && t instanceof Node && toolbarRef.current.contains(t));

    const onSelectionChange = () => {
      if (mouseDown.current) {
        // Dragging out a selection: hide until the button is released.
        if (toolRef.current?.kind === "selection") setTool(null);
        return;
      }
      schedule(lastPointer.current === "touch" ? 180 : 60);
    };
    const onPointerDown = (e: PointerEvent) => {
      lastPointer.current = e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
      if (inToolbar(e.target)) {
        pressing.current = true;
        return;
      }
      if (e.pointerType === "mouse" && e.button === 0) mouseDown.current = true;
      if (toolRef.current?.kind === "mark") setTool(null);
    };
    const onPointerUp = () => {
      if (pressing.current) {
        // Let the button's click run first, then resync with whatever selection is left.
        window.setTimeout(() => {
          pressing.current = false;
          schedule(200);
        }, 0);
        return;
      }
      if (mouseDown.current) {
        mouseDown.current = false;
        schedule(0);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      lastPointer.current = "touch";
      if (!inToolbar(e.target)) schedule(150);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // defaultPrevented: the dictionary popover took this Esc — the toolbar closes on the next one.
      if (e.key === "Escape" && toolRef.current && !e.defaultPrevented) setTool(null);
    };
    const onBlur = () => {
      mouseDown.current = false;
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);

    // Layout changes (text size, pane divider, rotation) move the text under the toolbar.
    let ro: ResizeObserver | null = null;
    if (rootRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        const cur = toolRef.current;
        if (!cur) return;
        if (cur.kind === "mark") setTool(null);
        else schedule(60);
      });
      ro.observe(rootRef.current);
    }

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      ro?.disconnect();
    };
  }, [fromSelection]);

  // Tap / click an existing highlight → offer "Remove" for it.
  const onTextClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as Element | null;
      const mark = target && typeof target.closest === "function" ? (target.closest("mark[data-s]") as HTMLElement | null) : null;
      if (!mark) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // the student is selecting, not tapping
      const p = Number(mark.dataset.p);
      const s = Number(mark.dataset.s);
      const end = Number(mark.dataset.e);
      if (![p, s, end].every(Number.isFinite) || end <= s) return;
      const rects = Array.from(mark.getClientRects()).filter((b) => b.width > 0 && b.height > 0);
      // Anchor on the line that was tapped (a highlight can wrap over several lines).
      const hit = rects.find((b) => e.clientY >= b.top && e.clientY <= b.bottom) ?? rects[0] ?? mark.getBoundingClientRect();
      const pos = place(hit, hit);
      if (!pos) return;
      setTool({ kind: "mark", segments: [{ p, s, e: end }], canHighlight: false, canRemove: true, ...pos });
    },
    [place]
  );

  const apply = useCallback(
    (action: "add" | "remove") => {
      const t = toolRef.current;
      if (!t) return;
      const src = passageRef.current;
      const cur = storeRef.current[src.id] ?? EMPTY_PART;
      const nextPart: Record<string, HighlightSpan[]> = { ...cur };
      for (const g of t.segments) {
        const len = src.paragraphs[g.p]?.text.length ?? 0;
        const list = nextPart[g.p] ?? EMPTY_SPANS;
        const next =
          action === "add" ? normalizeSpans([...list, [g.s, g.e]], len) : normalizeSpans(subtractSpan(list, [g.s, g.e]), len);
        if (next.length) nextPart[g.p] = next;
        else delete nextPart[g.p];
      }
      const nextStore: HighlightStore = { ...storeRef.current };
      if (Object.keys(nextPart).length) nextStore[src.id] = nextPart;
      else delete nextStore[src.id];
      commit(nextStore);
      pressing.current = false;
      setTool(null);
      try {
        window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore */
      }
      say(action === "add" ? "Highlight added" : "Highlight removed");
    },
    [commit, say]
  );

  // ---- dictionary: "Look up" in the toolbar (a double-click stays a plain selection) ----
  const openLookup = useCallback((seg: Segment, pointer: LookupRequest["pointer"]) => {
    const text = passageRef.current.paragraphs[seg.p]?.text ?? "";
    const word = normalizeWord(text.slice(seg.s, seg.e));
    const el = textRef.current?.querySelector(`[data-para="${seg.p}"]`);
    const range = word && el ? rangeFromOffsets(el, seg.s, seg.e) : null;
    if (!word || !range) return;
    setLook({
      id: ++lookSeq.current,
      text: word,
      context: sentenceAround(text, seg.s, seg.e) || undefined,
      pointer,
      getRect: () => rangeRect(range),
      returnFocus: pointer === "keyboard" ? lookButtonRef.current : null,
    });
    if (pointer === "touch") {
      // Dismiss the native selection menu / handles so they can't sit on top of the popover.
      setTool(null);
      try {
        window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const lookupFromTool = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const t = toolRef.current;
      if (!t || t.segments.length !== 1) return;
      pressing.current = false;
      // detail === 0: activated from the keyboard (Enter / Space).
      openLookup(t.segments[0], e.detail === 0 ? "keyboard" : lastPointer.current);
    },
    [openLookup]
  );

  const closeLookup = useCallback(() => setLook(null), []);

  // Keep the toolbar inside the pane horizontally (no sideways scroll on phones).
  useIsoLayoutEffect(() => {
    const w = toolbarRef.current?.offsetWidth;
    if (tool && w && Math.abs(w - toolbarWidth) > 1) setToolbarWidth(w);
  }, [tool, toolbarWidth]);

  // ---- passage switching: own scroll position per passage ---------------
  const positions = useRef<Record<string, number>>({});
  const shownId = useRef(passage.id);
  const firstPassage = useRef(true);
  useIsoLayoutEffect(() => {
    shownId.current = passage.id;
    const sp = findScrollParent(rootRef.current);
    if (sp) sp.scrollTop = positions.current[passage.id] ?? 0;
    setTool(null);
    setLook(null);
    setConfirmClear(false);
    if (firstPassage.current) {
      firstPassage.current = false;
      return;
    }
    // A selection left over from the previous passage must not turn into a toolbar on this one.
    try {
      const sel = window.getSelection();
      const root = rootRef.current;
      if (sel && sel.rangeCount && root && sel.getRangeAt(0).intersectsNode(root)) sel.removeAllRanges();
    } catch {
      /* ignore */
    }
  }, [passage.id]);
  useEffect(() => {
    const sp = findScrollParent(rootRef.current);
    if (!sp) return;
    const onScroll = () => {
      positions.current[shownId.current] = sp.scrollTop;
    };
    sp.addEventListener("scroll", onScroll, { passive: true });
    return () => sp.removeEventListener("scroll", onScroll);
  }, []);

  // ---- clear (two-step, so one stray tap can't wipe the student's notes) --
  useEffect(() => {
    if (!confirmClear) return;
    const t = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmClear]);

  const partSpans: Record<string, HighlightSpan[]> = store[passage.id] ?? EMPTY_PART;
  const highlightCount = Object.values(partSpans).reduce((n: number, list: HighlightSpan[]) => n + list.length, 0);
  const withLabels = passage.paragraphs.some((p) => !!p.label);

  const onClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const next: HighlightStore = { ...storeRef.current };
    delete next[passage.id];
    commit(next);
    setConfirmClear(false);
    setTool(null);
    say("Highlights cleared");
  };

  const half = toolbarWidth / 2;
  const toolLeft = tool ? Math.max(half + 8, Math.min(Math.max(half + 8, tool.rootWidth - half - 8), tool.x)) : 0;
  // Pressing a toolbar button must not collapse the selection it acts on.
  const keepSelection = (e: { preventDefault: () => void }) => e.preventDefault();
  // "Look up" for a selection (or a tapped highlight) of 1–3 words inside one paragraph.
  const lookSeg = lookup && tool && tool.segments.length === 1 ? tool.segments[0] : null;
  const canLookup = !!lookSeg && !!normalizeWord((passage.paragraphs[lookSeg.p]?.text ?? "").slice(lookSeg.s, lookSeg.e));
  const btnPad = lookup ? "px-3 sm:px-3.5" : "px-3.5";

  return (
    <article ref={rootRef} className="relative min-h-full w-full" aria-label={label ? `${label}: ${passage.title}` : passage.title}>
      <div className="mx-auto max-w-[70ch] px-5 pb-16 pt-6 leading-[1.75] text-gray-200 sm:px-8 sm:pt-8">
        <header className="mb-[1.5em]">
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            {label ? (
              <p className="text-[0.72em] font-bold uppercase tracking-[0.18em] text-averna-neon/80">{label}</p>
            ) : (
              <span />
            )}
            {highlightCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                aria-label={confirmClear ? "Confirm: clear all highlights in this passage" : "Clear all highlights in this passage"}
                className={cn(
                  "inline-flex min-h-[44px] shrink-0 select-none items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
                  confirmClear
                    ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                    : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                )}
              >
                <Eraser className="h-4 w-4" aria-hidden />
                {confirmClear ? "Clear all?" : "Clear highlights"}
              </button>
            )}
          </div>
          {intro && <p className="mt-[0.3em] break-words text-[0.9em] leading-relaxed text-gray-400">{intro}</p>}
          <h2 className="mt-[0.8em] break-words text-[1.4em] font-bold leading-snug text-white">{passage.title}</h2>
          {passage.subtitle && <p className="mt-[0.35em] break-words italic leading-relaxed text-gray-400">{passage.subtitle}</p>}
          {highlightCount === 0 && (
            <p className="mt-[0.9em] flex items-center gap-[0.45em] text-[0.8em] text-gray-500">
              <Highlighter className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />
              {lookup
                ? "Tip: select any words in the passage to highlight them or look them up."
                : "Tip: select any words in the passage to highlight them."}
            </p>
          )}
        </header>

        {/* Keyed by passage: switching passages gets fresh text nodes instead of rewriting the old ones in place. */}
        <div
          key={passage.id}
          ref={textRef}
          onClick={onTextClick}
          className="space-y-[1.1em] select-text selection:bg-averna-cyan/30 selection:text-white"
        >
          {passage.paragraphs.map((para, i) => (
            <Paragraph
              key={i}
              index={i}
              text={para.text ?? ""}
              label={para.label}
              withLabels={withLabels}
              spans={partSpans[i] ?? EMPTY_SPANS}
            />
          ))}
        </div>
      </div>

      {tool && (tool.canHighlight || tool.canRemove || canLookup) && (
        <div
          // Hidden, not removed, while the dictionary is open: Esc hands focus back to "Look up".
          hidden={!!look}
          className="pointer-events-none absolute z-20"
          style={{
            left: toolLeft,
            top: tool.y,
            transform: tool.placement === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
        >
          <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={lookup ? "Text tools" : "Highlight tools"}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            className="pointer-events-auto flex select-none items-center gap-1 rounded-xl border border-white/15 bg-[#0b1a16]/95 p-1 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.9)] backdrop-blur motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
          >
            {tool.canHighlight && (
              <button
                type="button"
                onClick={() => apply("add")}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
                  btnPad
                )}
              >
                <Highlighter className="h-4 w-4 text-amber-300" aria-hidden />
                Highlight
              </button>
            )}
            {canLookup && (
              <button
                ref={lookButtonRef}
                type="button"
                onClick={lookupFromTool}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold text-gray-100 transition-colors hover:bg-averna-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
                  btnPad
                )}
              >
                <Search className="h-4 w-4 text-averna-cyan" aria-hidden />
                Look up
              </button>
            )}
            {tool.canRemove && (
              <button
                type="button"
                onClick={() => apply("remove")}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
                  btnPad
                )}
              >
                <Eraser className="h-4 w-4" aria-hidden />
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {lookup && <WordPopover request={look} onClose={closeLookup} reviewLink={false} />}

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </article>
  );
}

export const PassagePane = memo(PassagePaneImpl);

export default PassagePane;
