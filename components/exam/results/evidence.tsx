"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BookOpen, ChevronDown, EyeOff, FileText, Headphones, Pause, Search, TextSearch } from "lucide-react";
import { LookupArea } from "@/components/dictionary/lookup-area";
import { HIGHLIGHT_COLORS } from "@/components/exam/exam-preferences";
import { hearFrom, type EvidenceSpan } from "@/lib/review/evidence";
import { cn } from "@/lib/utils";
import { docHasText, type EvidenceDoc } from "./evidence-doc";

/**
 * "Show me where" on the Reading / Listening result pages. One EvidenceScope
 * per reviewed part holds the passage (or transcript) and that part's
 * questions; a question's EvidenceActions highlight its evidence sentence:
 *
 * - desktop (lg+): Reading shows the passage beside the answers (sticky) and
 *   the sentence is highlighted in place; Listening opens the transcript inline;
 * - phone: a bottom sheet opens with the text scrolled to the sentence and a
 *   "Back to question N" button.
 *
 * The highlight is a <mark> in the exam highlight colour (no padding, so no
 * layout shift), focused (tabindex=-1) and announced. "Hear it" plays the
 * part's recording (ResultRecording) from the evidence time − 2 s.
 * Everything here renders on the result page only, after submission.
 */

interface Active {
  n: number;
  span: EvidenceSpan;
}

interface Player {
  playFrom(seconds: number): void;
  pause(): void;
}

interface ScopeValue {
  no: number;
  doc: EvidenceDoc;
  active: Active | null;
  sheet: boolean;
  open: boolean;
  setOpen(open: boolean): void;
  show(n: number, span: EvidenceSpan, trigger: HTMLElement | null): void;
  hide(): void;
  markRef: MutableRefObject<HTMLElement | null>;
  registerPlayer(player: Player | null): void;
  hasPlayer: boolean;
  hear(n: number, seconds: number): void;
  stop(): void;
  playing: number | null;
  setPlaying(n: number | null): void;
}

const Ctx = createContext<ScopeValue | null>(null);

const DESKTOP_QUERY = "(min-width: 1024px)";
const isDesktop = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Secondary pill button, ≥ 44 px tall. */
const ACTION_BTN =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none";

export function EvidenceScope({
  no,
  doc,
  sideBySide = false,
  media = null,
  children,
}: {
  no: number;
  doc: EvidenceDoc;
  /** Reading: passage beside the answers from lg up. */
  sideBySide?: boolean;
  /** Above the text panel (Listening: the part's ResultRecording). */
  media?: ReactNode;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Active | null>(null);
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [hasPlayer, setHasPlayer] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const markRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  const show = useCallback((n: number, span: EvidenceSpan, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setActive({ n, span });
    if (isDesktop()) {
      setSheet(false);
      setOpen(true);
    } else setSheet(true);
    setMessage(`Evidence for question ${n} highlighted`);
  }, []);

  const current = useRef<{ active: Active | null; sheet: boolean }>({ active: null, sheet: false });
  current.current = { active, sheet };

  const hide = useCallback(() => {
    const { active: a, sheet: wasSheet } = current.current;
    if (a) setMessage(`Evidence for question ${a.n} hidden`);
    setActive(null);
    setSheet(false);
    // Back from the sheet: focus returns to the question's button.
    if (wasSheet) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const registerPlayer = useCallback((p: Player | null) => {
    playerRef.current = p;
    setHasPlayer(!!p);
  }, []);

  const hear = useCallback((n: number, seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    const from = hearFrom(seconds);
    p.playFrom(from);
    setPlaying(n);
    setMessage(`Playing question ${n} from ${clock(from)}`);
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.pause();
    setPlaying(null);
  }, []);

  // Scroll the highlighted sentence into view and move focus to it.
  useEffect(() => {
    const el = markRef.current;
    if (!active || !el) return;
    el.scrollIntoView?.({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [active, sheet]);

  // The sheet covers the page: no page scroll behind it.
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const value = useMemo<ScopeValue>(
    () => ({
      no,
      doc,
      active,
      sheet,
      open,
      setOpen,
      show,
      hide,
      markRef,
      registerPlayer,
      hasPlayer,
      hear,
      stop,
      playing,
      setPlaying,
    }),
    [no, doc, active, sheet, open, show, hide, registerPlayer, hasPlayer, hear, stop, playing]
  );

  return (
    <Ctx.Provider value={value}>
      <p aria-live="polite" role="status" className="sr-only">
        {message}
      </p>
      {sideBySide ? (
        <div className="mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <TextPanel sticky />
          <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
        </div>
      ) : (
        <>
          {media}
          <TextPanel />
          <div className="mt-6">{children}</div>
        </>
      )}
      {sheet && active && <EvidenceSheet />}
    </Ctx.Provider>
  );
}

function useScope(): ScopeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("Evidence components must sit inside <EvidenceScope>.");
  return v;
}

// ---------------------------------------------------------------------------
// Text with the highlighted sentence
// ---------------------------------------------------------------------------

function Highlighted({ text, index, active, markRef }: { text: string; index: number; active: Active | null; markRef: MutableRefObject<HTMLElement | null> | null }) {
  if (!active || !markRef || active.span.paragraphIndex !== index) return <>{text}</>;
  const { span, n } = active;
  const start = Math.max(0, Math.min(span.start, text.length));
  const end = Math.max(start, Math.min(span.end, text.length));
  return (
    <>
      {text.slice(0, start)}
      <mark
        ref={(el) => {
          markRef.current = el;
        }}
        tabIndex={-1}
        data-evidence={n}
        className="rounded-[0.2em] box-decoration-clone outline-none focus:ring-2 focus:ring-averna-neon/50"
        style={{ backgroundColor: HIGHLIGHT_COLORS[0].fill, color: "inherit" }}
      >
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function DocBody({ doc, active, markRef }: { doc: EvidenceDoc; active: Active | null; markRef: MutableRefObject<HTMLElement | null> | null }) {
  if (doc.kind === "passage") {
    return (
      <LookupArea className="space-y-3.5 text-[15px] leading-relaxed text-gray-200">
        {doc.paragraphs.map((p, i) =>
          p.text.trim() ? (
            <p key={`${p.label ?? ""}${i}`} className="flex gap-3">
              {p.label ? (
                <span className="w-5 shrink-0 select-none font-bold text-averna-cyan">
                  <span className="sr-only">Paragraph </span>
                  {p.label}
                </span>
              ) : null}
              <span className="min-w-0" data-lookup-text="">
                <Highlighted text={p.text} index={i} active={active} markRef={markRef} />
              </span>
            </p>
          ) : null
        )}
      </LookupArea>
    );
  }
  return (
    <LookupArea>
      <ol role="list" className="space-y-2.5 text-[15px] leading-relaxed">
        {doc.lines.map((l) => (
          <li key={l.index} className={cn(l.narrator ? "italic text-gray-400" : "text-gray-200")}>
            <span className={cn("mr-2", l.narrator ? "font-medium text-gray-500" : "font-bold text-white")}>
              {l.speaker || "Speaker"}:
            </span>
            <span data-lookup-text="">
              <Highlighted text={l.text} index={l.index} active={active} markRef={markRef} />
            </span>
          </li>
        ))}
      </ol>
    </LookupArea>
  );
}

// ---------------------------------------------------------------------------
// The passage / transcript panel (collapsible; sticky beside the answers on desktop)
// ---------------------------------------------------------------------------

function TextPanel({ sticky = false }: { sticky?: boolean }) {
  const { no, doc, open, setOpen, active, sheet, markRef } = useScope();
  const bodyId = useId();
  const passage = doc.kind === "passage";
  const Icon = passage ? BookOpen : FileText;
  const what = passage ? "passage" : "transcript";
  if (!docHasText(doc)) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.02] print:hidden",
        !sticky && "mt-4",
        sticky && "lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col"
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold text-gray-100 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none",
          sticky && "lg:hidden"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", passage ? "text-averna-cyan" : "text-averna-purple")} aria-hidden />
        <span className="flex-1">
          {open ? `Hide ${what}` : `Show ${what}`}
          <span className="sr-only"> — {passage ? `Reading Passage ${no}` : `Part ${no}`}</span>
          {passage && doc.words ? (
            <span className="ml-2 font-normal text-gray-500">· about {Math.round(doc.words / 10) * 10} words</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        className={cn(
          "border-t border-white/10 px-4 pb-5 pt-4 sm:px-5",
          open ? "block" : "hidden",
          sticky && "lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:border-t-0"
        )}
      >
        <DocHeader />
        <div className="mt-4">
          <DocBody doc={doc} active={active} markRef={sheet ? null : markRef} />
        </div>
      </div>
    </div>
  );
}

function DocHeader() {
  const { no, doc } = useScope();
  if (doc.kind === "passage") {
    return (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Reading Passage {no}</p>
        <p className="mt-1 text-base font-semibold text-white">{doc.title}</p>
        {doc.subtitle && <p className="mt-1 text-sm italic text-gray-400">{doc.subtitle}</p>}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Tip: select any word to look it up.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Transcript · Part {no}</p>
      {doc.context && <p className="mt-1 text-sm italic text-gray-400">{doc.context}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Tip: select any word to look it up.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Phone: the bottom sheet
// ---------------------------------------------------------------------------

function EvidenceSheet() {
  const { no, doc, active, hide, markRef } = useScope();
  const titleId = useId();
  if (!active || typeof document === "undefined") return null;
  const n = active.n;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col justify-end bg-background/80 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          hide();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-white/10 bg-background shadow-2xl"
      >
        <header className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            {doc.kind === "passage" ? `Reading Passage ${no}` : `Transcript · Part ${no}`}
          </p>
          <h2 id={titleId} className="mt-0.5 text-base font-semibold text-white">
            Evidence for question {n}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {doc.kind === "passage" && <p className="mb-3 text-sm font-semibold text-white">{doc.title}</p>}
          <DocBody doc={doc} active={active} markRef={markRef} />
        </div>
        <footer className="border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={hide}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-averna-neon px-4 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to question {n}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Per question: Show in text / Hide · Hear it
// ---------------------------------------------------------------------------

export function EvidenceActions({ n, span, seconds = null }: { n: number; span: EvidenceSpan | null; seconds?: number | null }) {
  const { doc, active, show, hide, hasPlayer, hear, stop, playing } = useScope();
  const shown = active?.n === n;
  const canHear = seconds != null && hasPlayer;
  if (!span && !canHear) return null;
  const word = doc.kind === "passage" ? "text" : "transcript";

  return (
    <div className="mt-2.5 flex flex-wrap gap-2 print:hidden">
      {canHear && (
        <button
          type="button"
          onClick={() => (playing === n ? stop() : hear(n, seconds!))}
          className={cn(ACTION_BTN, "border-averna-purple/35 bg-averna-purple/[0.08] text-gray-100 hover:bg-averna-purple/15")}
        >
          {playing === n ? <Pause className="h-4 w-4" aria-hidden /> : <Headphones className="h-4 w-4" aria-hidden />}
          {playing === n ? "Pause" : "Hear it"}
          <span className="sr-only"> — question {n}</span>
        </button>
      )}
      {span && (
        <button
          type="button"
          aria-pressed={shown}
          onClick={(e) => (shown ? hide() : show(n, span, e.currentTarget))}
          className={cn(
            ACTION_BTN,
            shown
              ? "border-averna-cyan/50 bg-averna-cyan/15 text-white"
              : "border-averna-cyan/30 bg-averna-cyan/[0.06] text-averna-cyan hover:bg-averna-cyan/10"
          )}
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <TextSearch className="h-4 w-4" aria-hidden />}
          {shown ? "Hide" : `Show in ${word}`}
          <span className="sr-only"> — evidence for question {n}</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listening: the part's recording
// ---------------------------------------------------------------------------

/** The part's recording on the result page; "Hear it" seeks and plays it. */
export function ResultRecording({ url, no, durationMs }: { url: string; no: number; durationMs?: number }) {
  const { registerPlayer, setPlaying } = useScope();
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const player: Player = {
      playFrom(seconds: number) {
        const a = ref.current;
        if (!a) return;
        try {
          a.currentTime = seconds;
        } catch {
          /* not seekable yet: plays from the start */
        }
        const p = a.play() as Promise<void> | undefined;
        if (p && typeof p.catch === "function") p.catch(() => setPlaying(null));
      },
      pause() {
        ref.current?.pause();
      },
    };
    registerPlayer(player);
    return () => registerPlayer(null);
  }, [registerPlayer, setPlaying]);

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 print:hidden">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
        <Headphones className="h-4 w-4 shrink-0 text-averna-purple" aria-hidden />
        Recording · Part {no}
        {durationMs && durationMs > 0 ? <span className="font-normal text-gray-500">· {clock(durationMs / 1000)}</span> : null}
      </p>
      {/* The transcript below is the text alternative. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ref}
        src={url}
        controls
        preload="none"
        aria-label={`Recording of Part ${no}`}
        className="mt-2 w-full"
        onPause={() => setPlaying(null)}
        onEnded={() => setPlaying(null)}
      />
    </div>
  );
}
