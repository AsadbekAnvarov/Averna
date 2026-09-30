"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeWord } from "@/lib/dictionary-core";
import { contextOfRange, rangeRect } from "./dom";
import { WordPopover, type LookupRequest } from "./word-popover";

/**
 * Makes the English text inside it look-up-able (server-rendered children are
 * fine): double-click a word (mouse), or select 1–3 words — mouse drag, touch
 * long-press or keyboard — and press the "Look up" chip that appears next to
 * the selection. Opens the dictionary popover (components/dictionary/word-popover).
 *
 * The chip lives right after the text in the DOM, so a keyboard selection can
 * Tab straight to it; it is hidden (not removed) while the popover is open so
 * Esc can hand focus back to it.
 */

interface Chip {
  word: string;
  context: string;
  range: Range;
  /** Anchor in root coordinates. */
  x: number;
  y: number;
  side: "above" | "below";
  rootWidth: number;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
/** Anything longer is not a 1–3 word selection. */
const MAX_SELECTION_CHARS = 120;

export interface LookupAreaProps {
  children: React.ReactNode;
  /** Classes for the element that holds the text. */
  className?: string;
  /** Offer "Review in Flashcards" after saving (default true). */
  reviewLink?: boolean;
}

export function LookupArea({ children, className, reviewLink = true }: LookupAreaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const chipButtonRef = useRef<HTMLButtonElement>(null);
  const [chip, setChip] = useState<Chip | null>(null);
  const chipState = useRef<Chip | null>(null);
  chipState.current = chip;
  const [request, setRequest] = useState<LookupRequest | null>(null);
  const requestState = useRef<LookupRequest | null>(null);
  requestState.current = request;
  const [chipWidth, setChipWidth] = useState(120);

  const lastPointer = useRef<"mouse" | "touch">("mouse");
  const mouseDown = useRef(false);
  /** A press on the chip is in progress — the collapsing selection must not hide it first. */
  const pressing = useRef(false);
  const seq = useRef(0);

  const fromSelection = useCallback((): Chip | null => {
    const root = rootRef.current;
    if (!root) return null;
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
      const range = sel.getRangeAt(0);
      const content = root.firstElementChild;
      if (!content || !content.contains(range.startContainer) || !content.contains(range.endContainer)) return null;
      const text = range.toString();
      if (text.length > MAX_SELECTION_CHARS) return null;
      const word = normalizeWord(text);
      if (!word) return null;

      const rects = Array.from(range.getClientRects()).filter((b) => b.width > 0 && b.height > 0);
      const first = rects[0] ?? range.getBoundingClientRect();
      const last = rects[rects.length - 1] ?? first;
      const rootRect = root.getBoundingClientRect();
      const touch = lastPointer.current === "touch";
      // Touch: below the words, clear of the native selection menu and handles. Mouse: above, when there is room.
      const side: "above" | "below" = !touch && first.top > 64 ? "above" : "below";
      const anchor = side === "above" ? first : last;
      return {
        word,
        context: contextOfRange(range, root),
        range: range.cloneRange(),
        x: anchor.left + anchor.width / 2 - rootRect.left,
        y: (side === "above" ? anchor.top - 8 : anchor.bottom + (touch ? 28 : 8)) - rootRect.top,
        side,
        rootWidth: rootRect.width,
      };
    } catch {
      return null;
    }
  }, []);

  const open = useCallback((c: Chip, pointer: LookupRequest["pointer"]) => {
    const range = c.range;
    setRequest({
      id: ++seq.current,
      text: c.word,
      context: c.context || undefined,
      pointer,
      getRect: () => rangeRect(range),
      returnFocus: pointer === "keyboard" ? chipButtonRef.current : null,
    });
    if (pointer === "touch") {
      // Dismiss the native selection menu / handles so they can't sit on top of the popover.
      try {
        window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore */
      }
      setChip(null);
    }
  }, []);

  // ---- selection → chip ------------------------------------------------------------
  useEffect(() => {
    let timer = 0;
    const run = () => {
      timer = 0;
      if (pressing.current || requestState.current) return;
      const next = fromSelection();
      if (next) {
        setChip(next);
        return;
      }
      if (chipRef.current?.contains(document.activeElement)) return; // keyboard user is on the chip
      setChip(null);
    };
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    };
    const inChip = (t: EventTarget | null) => !!(chipRef.current && t instanceof Node && chipRef.current.contains(t));

    const onSelectionChange = () => {
      if (mouseDown.current) {
        if (chipState.current) setChip(null); // dragging: hide until the button is released
        return;
      }
      schedule(lastPointer.current === "touch" ? 180 : 80);
    };
    const onPointerDown = (e: PointerEvent) => {
      lastPointer.current = e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
      if (inChip(e.target)) {
        pressing.current = true;
        return;
      }
      if (e.pointerType === "mouse" && e.button === 0) mouseDown.current = true;
    };
    const onPointerUp = () => {
      if (pressing.current) {
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && chipState.current) setChip(null);
    };
    const onBlur = () => {
      mouseDown.current = false;
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);

    let ro: ResizeObserver | null = null;
    if (rootRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (chipState.current) schedule(60);
      });
      ro.observe(rootRef.current);
    }
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      ro?.disconnect();
    };
  }, [fromSelection]);

  // Keep the chip inside the text column horizontally.
  useIsoLayoutEffect(() => {
    const w = chipRef.current?.offsetWidth;
    if (chip && w && Math.abs(w - chipWidth) > 1) setChipWidth(w);
  }, [chip, chipWidth]);

  const onDoubleClick = () => {
    if (lastPointer.current === "touch") return; // touch: long-press + "Look up"
    const c = fromSelection();
    if (c) open(c, "mouse");
  };

  const onChipClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const c = chipState.current ?? fromSelection();
    if (!c) return;
    // detail === 0: activated from the keyboard (Enter / Space).
    open(c, e.detail === 0 ? "keyboard" : lastPointer.current);
  };

  const onClose = useCallback(() => {
    setRequest(null);
  }, []);

  const half = chipWidth / 2;
  const chipLeft = chip ? Math.max(half + 4, Math.min(Math.max(half + 4, chip.rootWidth - half - 4), chip.x)) : 0;
  // Pressing the chip must not collapse the selection it acts on.
  const keepSelection = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div ref={rootRef} className="relative">
      <div className={className} onDoubleClick={onDoubleClick}>
        {children}
      </div>
      {chip && (
        <div
          hidden={!!request}
          className="pointer-events-none absolute z-20"
          style={{
            left: chipLeft,
            top: chip.y,
            transform: chip.side === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
        >
          <div
            ref={chipRef}
            onPointerDown={keepSelection}
            onMouseDown={keepSelection}
            className="pointer-events-auto flex select-none items-center rounded-xl border border-white/15 bg-surface-raised/95 av-float p-1 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.9)] backdrop-blur motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
          >
            <button
              ref={chipButtonRef}
              type="button"
              onClick={onChipClick}
              aria-label={`Look up “${chip.word}” in the dictionary`}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-gray-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
            >
              <Search className="h-4 w-4 text-averna-cyan" aria-hidden />
              Look up
            </button>
          </div>
        </div>
      )}
      <WordPopover request={request} onClose={onClose} reviewLink={reviewLink} />
    </div>
  );
}

export default LookupArea;
