"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertCircle, BookmarkPlus, Check, Loader2, RotateCcw, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DICT_LANGS,
  DICT_LANG_LABEL,
  markHeadword,
  normalizeWord,
  type DictEntry,
  type DictLang,
  type LookupResponse,
} from "@/lib/dictionary-core";
import { canSpeak, fetchLookup, getPreferredLang, saveMyWord, setPreferredLang, speakEnglish, stopSpeaking } from "./client";
import { placePopover, type Placement } from "./position";

/**
 * The in-text dictionary popover: headword, part of speech, IPA, a simple
 * English definition, the translation (Uzbek / Russian, switchable and
 * remembered), one example, "Listen" (speechSynthesis, en-GB) and "Add to my
 * words".
 *
 * Rendered in a portal on <body> with position: fixed (so no transformed /
 * backdrop-filtered ancestor can trap it) above or below the word — never on
 * it — and clamped to the visible viewport. Focus moves into it; Tab cycles
 * inside; Esc / Close return focus to the opener. It closes on Esc, a press
 * outside, and a scroll that moves the word.
 */

export interface LookupRequest {
  /** Unique per lookup, so every word starts with fresh state. */
  id: number;
  /** The selected text (normalised here). */
  text: string;
  /** The sentence around the word — only orders the senses. */
  context?: string;
  /** Current viewport rect of the word (live, follows reflow); null when it is gone. */
  getRect: () => DOMRect | null;
  /** Touch lookups prefer the popover below the word, clear of the finger. */
  pointer: "mouse" | "touch" | "keyboard";
  /** Where focus goes back on Esc / Close; undefined = whatever was focused when it opened, null = nowhere. */
  returnFocus?: HTMLElement | null;
}

export type CloseReason = "escape" | "button" | "outside" | "scroll";

export interface WordPopoverProps {
  request: LookupRequest | null;
  onClose: (reason: CloseReason) => void;
  /** Offer the "Review" link to /flashcards once saved (off inside a test, where leaving would abandon it). */
  reviewLink?: boolean;
}

export function WordPopover({ request, onClose, reviewLink = true }: WordPopoverProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!request || !mounted) return null;
  return createPortal(<PopoverPanel key={request.id} request={request} onClose={onClose} reviewLink={reviewLink} />, document.body);
}

export default WordPopover;

// ---------------------------------------------------------------------------

type View =
  | { phase: "loading"; stale?: LookupResponse }
  | { phase: "ready"; data: LookupResponse }
  | { phase: "error"; status: number; message: string };

type SaveState = { phase: "idle" | "saving" | "saved" } | { phase: "error"; message: string };

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** A scroll that moves the word more than this closes the popover. */
const SCROLL_CLOSE_PX = 12;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function viewport(): { top: number; left: number; width: number; height: number } {
  const vv = window.visualViewport;
  return vv
    ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
    : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

function usableRect(r: DOMRect | null): r is DOMRect {
  return !!r && !(r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0);
}

function PopoverPanel({ request, onClose, reviewLink }: { request: LookupRequest; onClose: (r: CloseReason) => void; reviewLink: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const word = useMemo(() => normalizeWord(request.text), [request.text]);

  const [lang, setLang] = useState<DictLang | null>(() => getPreferredLang());
  const [view, setView] = useState<View>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [save, setSave] = useState<SaveState>({ phase: "idle" });
  const [announce, setAnnounce] = useState("");
  const [pos, setPos] = useState<Placement | null>(null);
  const [speech, setSpeech] = useState(false);

  const requestRef = useRef(request);
  requestRef.current = request;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const restoreFocus = useRef(false);
  const alive = useRef(true);
  const base = useRef<{ top: number; left: number } | null>(null);
  const lastData = useRef<LookupResponse | null>(null);

  const close = useCallback((reason: CloseReason) => {
    restoreFocus.current = reason === "escape" || reason === "button";
    onCloseRef.current(reason);
  }, []);

  // ---- data ----------------------------------------------------------------
  useEffect(() => {
    if (!word) {
      setView({ phase: "error", status: 400, message: "Select one English word or a short phrase (up to 3 words)." });
      return;
    }
    const ctrl = new AbortController();
    setView({ phase: "loading", stale: lastData.current ?? undefined });
    fetchLookup(word, lang, request.context, ctrl.signal).then((res) => {
      if (ctrl.signal.aborted || !alive.current) return;
      if (res.ok) {
        lastData.current = res.data;
        setView({ phase: "ready", data: res.data });
        setSave((s) => (res.data.saved ? { phase: "saved" } : s.phase === "saved" ? s : { phase: "idle" }));
        const first = res.data.entry.senses[0];
        setAnnounce(
          [res.data.entry.headword, first?.definition, first?.translation].filter(Boolean).join(". ")
        );
      } else if (!res.aborted) {
        setView({ phase: "error", status: res.status, message: res.error });
        setAnnounce(res.error);
      }
    });
    return () => ctrl.abort();
  }, [word, lang, attempt, request.context]);

  useEffect(() => {
    alive.current = true;
    setSpeech(canSpeak());
    return () => {
      alive.current = false;
      stopSpeaking();
    };
  }, []);

  // ---- focus: in on open, back to the opener on Esc / Close --------------------
  useEffect(() => {
    const active = document.activeElement;
    // An explicit null (mouse / touch lookups) means: don't move focus back anywhere.
    const opener =
      request.returnFocus !== undefined
        ? request.returnFocus
        : active instanceof HTMLElement && active !== document.body
          ? active
          : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (!restoreFocus.current) return;
      const now = document.activeElement;
      if (opener?.isConnected && (!now || now === document.body)) opener.focus({ preventScroll: true });
    };
    // Mount / unmount only (the panel is keyed per lookup).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- position --------------------------------------------------------------
  const place = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = requestRef.current.getRect();
    if (!usableRect(rect)) {
      close("scroll");
      return;
    }
    base.current = { top: rect.top, left: rect.left };
    const body = bodyRef.current;
    const natural = el.offsetHeight + (body ? body.scrollHeight - body.clientHeight : 0);
    const next = placePopover(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      { width: el.offsetWidth, height: natural },
      viewport(),
      "below"
    );
    setPos((p: Placement | null) =>
      p && p.top === next.top && p.left === next.left && p.maxHeight === next.maxHeight && p.side === next.side ? p : next
    );
  }, [close]);

  useIsoLayoutEffect(() => {
    place();
  }, [place, view.phase, save.phase]);

  useEffect(() => {
    const el = panelRef.current;
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => place());
      ro.observe(el);
      const inner = bodyRef.current?.firstElementChild;
      if (inner) ro.observe(inner);
    }
    const vv = window.visualViewport;
    window.addEventListener("resize", place);
    vv?.addEventListener("resize", place);
    vv?.addEventListener("scroll", place);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
      vv?.removeEventListener("resize", place);
      vv?.removeEventListener("scroll", place);
    };
  }, [place]);

  // ---- closing: Esc, a press outside, a scroll that moves the word ------------------
  useEffect(() => {
    const inside = (t: EventTarget | null) => !!(panelRef.current && t instanceof Node && panelRef.current.contains(t));
    const onPointerDown = (e: PointerEvent) => {
      if (!inside(e.target)) close("outside");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Marked as handled so text tools underneath (the highlight toolbar) stay open for a second Esc.
      e.preventDefault();
      close("escape");
    };
    const onScroll = (e: Event) => {
      if (inside(e.target)) return;
      const r = requestRef.current.getRect();
      const b = base.current;
      if (!usableRect(r) || !b || Math.abs(r.top - b.top) > SCROLL_CLOSE_PX || Math.abs(r.left - b.left) > SCROLL_CLOSE_PX) {
        close("scroll");
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [close]);

  // Tab stays inside the popover (Esc leaves).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const panel: HTMLDivElement | null = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // ---- actions ------------------------------------------------------------------
  const data = view.phase === "ready" ? view.data : view.phase === "loading" ? view.stale ?? null : null;
  const entry: DictEntry | null = data?.entry ?? null;
  const shownLang: DictLang | null = lang ?? data?.lang ?? null;

  const pickLang = (l: DictLang) => {
    setPreferredLang(l);
    setLang(l);
  };

  const onSave = async () => {
    if (view.phase !== "ready" || save.phase === "saving" || save.phase === "saved") return;
    setSave({ phase: "saving" });
    const res = await saveMyWord(view.data.word, view.data.lang);
    if (!alive.current) return;
    if (res.ok) {
      setSave({ phase: "saved" });
      setAnnounce(`${view.data.entry.headword} added to My words.`);
    } else {
      setSave({ phase: "error", message: res.error });
      setAnnounce(res.error);
    }
  };

  const headword = entry?.headword ?? (word || request.text.trim().slice(0, 40));
  const loading = view.phase === "loading";
  // The language switch stays available after a failed switch, so the student can go back.
  const switchable = !!(data ?? lastData.current)?.translated;
  const invalid = view.phase === "error" && view.status === 400;
  // While loading, keep the (disabled) button in place so the popover doesn't jump when it resolves.
  const canSave = view.phase === "ready" ? view.data.canSave : view.phase === "loading" ? view.stale?.canSave ?? true : false;
  const retryable = view.phase === "error" && (view.status === 0 || view.status === 429 || view.status >= 500);
  const [firstSense, ...otherSenses] = entry?.senses ?? [];
  const example = firstSense?.example
    ? markHeadword(firstSense.example, [entry?.headword ?? "", entry?.lemma ?? "", word ?? ""])
    : [];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-dictionary-popover=""
      className={cn(
        "fixed z-[75] flex w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1a16]/[0.97] text-left text-sm text-gray-200 shadow-[0_18px_48px_-14px_rgba(0,0,0,0.9)] outline-none backdrop-blur",
        pos && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
      )}
      style={{
        // Until it is measured and placed: laid out but invisible (still focusable, unlike visibility: hidden).
        top: pos ? pos.top : 0,
        left: pos ? pos.left : 0,
        maxHeight: pos ? pos.maxHeight : undefined,
        opacity: pos ? undefined : 0,
        pointerEvents: pos ? undefined : "none",
      }}
    >
      {/* Header: headword, part of speech, IPA, close */}
      <div className="flex shrink-0 items-start gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="break-words text-lg font-bold leading-snug text-white">
            {headword}
          </h2>
          <div className="mt-0.5 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 text-[13px] text-gray-400">
            {entry ? (
              <>
                {entry.pos && <span className="italic">{entry.pos}</span>}
                {entry.ipa && <span className="font-medium text-averna-cyan">{entry.ipa}</span>}
              </>
            ) : loading ? (
              <span aria-hidden className="h-3 w-28 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => close("button")}
          aria-label="Close dictionary"
          className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Listen + translation language */}
      {(speech || switchable) && !invalid && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-2">
          {speech && (
            <button
              type="button"
              onClick={() => speakEnglish(headword)}
              aria-label={`Listen: ${headword}`}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-gray-100 transition-colors hover:border-averna-cyan/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
            >
              <Volume2 className="h-4 w-4 text-averna-cyan" aria-hidden />
              Listen
            </button>
          )}
          {switchable && (
            <div role="group" aria-label="Translation language" className="ml-auto inline-flex rounded-lg border border-white/10 p-0.5">
              {DICT_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={shownLang === l}
                  onClick={() => pickLang(l)}
                  title={DICT_LANG_LABEL[l].native}
                  className={cn(
                    "min-h-[32px] min-w-[2.5rem] rounded-md px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
                    shownLang === l ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:text-white"
                  )}
                >
                  <span aria-hidden>{DICT_LANG_LABEL[l].short}</span>
                  <span className="sr-only">{DICT_LANG_LABEL[l].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body (scrolls when the viewport is short) */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-2.5">
        <div className={cn(loading && data && "opacity-60 transition-opacity motion-reduce:transition-none")}>
          {view.phase === "error" ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]",
                retryable ? "border-red-400/30 bg-red-500/[0.08] text-red-100" : "border-white/10 bg-white/[0.03] text-gray-300"
              )}
            >
              <AlertCircle className={cn("mt-0.5 h-4 w-4 shrink-0", retryable ? "text-red-300" : "text-gray-500")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p>{view.message}</p>
                {retryable && (
                  <button
                    type="button"
                    onClick={() => setAttempt((n: number) => n + 1)}
                    className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-md text-xs font-semibold text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Try again
                  </button>
                )}
              </div>
            </div>
          ) : !entry ? (
            <div aria-hidden className="space-y-2">
              <div className="h-4 w-11/12 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-averna-neon/15 motion-reduce:animate-none" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              {firstSense && (
                <div>
                  <p className="text-[15px] leading-snug text-gray-100">{firstSense.definition}</p>
                  {firstSense.translation && (
                    <p className="mt-1 font-semibold text-averna-neon" lang={shownLang ?? undefined}>
                      {firstSense.translation}
                    </p>
                  )}
                  {example.length > 0 && (
                    <p className="mt-2 border-l-2 border-averna-neon/30 pl-2.5 text-[13px] italic leading-snug text-gray-400">
                      {example.map((p, i) =>
                        p.hit ? (
                          <strong key={i} className="font-semibold text-gray-100">
                            {p.text}
                          </strong>
                        ) : (
                          <span key={i}>{p.text}</span>
                        )
                      )}
                    </p>
                  )}
                </div>
              )}
              {otherSenses.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Other meanings</p>
                  <ol className="mt-1.5 space-y-1.5">
                    {otherSenses.map((s, i) => (
                      <li key={i} className="text-[13px] leading-snug text-gray-300">
                        {s.definition}
                        {s.translation && (
                          <span className="font-semibold text-averna-neon/90" lang={shownLang ?? undefined}>
                            {" "}
                            — {s.translation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {entry.note && (
                <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] leading-snug text-gray-300">
                  <span className="font-semibold text-gray-100">Tip: </span>
                  {entry.note}
                </p>
              )}
              {data && !data.translated && (
                <p className="mt-3 text-xs text-gray-500">Translation isn&apos;t available right now — this is the English dictionary.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add to my words */}
      {canSave && view.phase !== "error" && (
        <div className="shrink-0 border-t border-white/10 px-3 py-2.5">
          {save.phase === "saved" ? (
            <div className="flex min-h-[44px] items-center justify-between gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-averna-neon">
                <Check className="h-4 w-4" aria-hidden />
                In My words
              </span>
              {reviewLink && (
                <Link
                  href="/flashcards?deck=my-words"
                  className="rounded-md px-2 py-1.5 text-xs font-semibold text-gray-300 underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                >
                  Review in Flashcards
                </Link>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={view.phase !== "ready" || save.phase === "saving"}
                className="glow-hover inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.08] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-60"
              >
                {save.phase === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <BookmarkPlus className="h-4 w-4 text-averna-neon" aria-hidden />
                )}
                {save.phase === "saving" ? "Adding…" : "Add to my words"}
              </button>
              {save.phase === "error" && <p className="mt-1.5 px-1 text-xs text-red-300">{save.message}</p>}
            </>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {loading && !data ? `Looking up ${headword}…` : announce}
      </p>
    </div>
  );
}
