"use client";

/** Presentation only: enabled by the versioned CDI orchestrator, never by practice mode. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Bell, Check, ChevronLeft, ChevronRight, Menu, Pencil, Wifi, X } from "lucide-react";
import type { ExamShellProps } from "./exam-shell";
import type { MockView } from "@/lib/ielts/mock";
import { MockSaveStatus } from "./mock-save-status";
import { ReviewDialog } from "./exam-review-dialog";
import { formatClock } from "./use-exam";
import "./mock-cdi.css";

type Contrast = "bw" | "wb" | "yb";
type Annotation = { id: string; anchor: string; from: number; to: number; quote: string; note: string | null };
type CdiState = {
  contrast: Contrast; setContrast: (v: Contrast) => void;
  scale: number; setScale: (v: number) => void;
  notes: Annotation[]; setNotes: React.Dispatch<React.SetStateAction<Annotation[]>>;
  notesOpen: boolean; setNotesOpen: (v: boolean) => void;
};
const MockCdiContext = createContext<CdiState | null>(null);
export const useMockCdi = () => useContext(MockCdiContext);

export function MockCdiProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [contrast, setContrast] = useState<Contrast>("bw");
  const [scale, setScale] = useState(1);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  if (!enabled) return <>{children}</>;
  return <MockCdiContext.Provider value={{ contrast, setContrast, scale, setScale, notes, setNotes, notesOpen, setNotesOpen }}>
    <div className="mock-cdi" data-contrast={contrast} style={{ "--mc-scale": scale } as CSSProperties}>{children}</div>
  </MockCdiContext.Provider>;
}

/** Restores focus and contains keyboard navigation in menu/review dialogs. */
function useDialogFocus(open: boolean, ref: React.RefObject<HTMLDivElement | null>, close: () => void) {
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      if (e.key !== "Tab") return;
      const items = focusable(); const first = items[0]; const last = items[items.length - 1];
      if (!items.length) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !node?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !node?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); if (before?.isConnected) before.focus({ preventScroll: true }); };
  }, [open, ref]);
}

function MockOptions({ close }: { close: () => void }) {
  const cdi = useMockCdi()!;
  const [page, setPage] = useState<"options" | "contrast" | "size" | "instructions">("options");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, close);
  const title = { options: "Options", contrast: "Contrast", size: "Text size", instructions: "Test instructions" }[page];
  return <div className="mc-options" role="dialog" aria-modal="true" aria-labelledby="mc-options-title" ref={ref}>
    <header>{page !== "options" ? <button onClick={() => setPage("options")} className="mc-options-back"><ChevronLeft size={18} />Options</button> : <span />}<h2 id="mc-options-title">{title}</h2><button className="mc-icon" onClick={close} aria-label="Close options"><X /></button></header>
    <div className="mc-options-card">
      {page === "options" && <>{([['Contrast', 'contrast'], ['Text size', 'size'], ['Test instructions', 'instructions']] as const).map(([label, key]) => <button className="mc-menu-row" key={key} onClick={() => setPage(key)}>{label}<ChevronRight size={18} /></button>)}</>}
      {page === "contrast" && ([['Black on white', 'bw'], ['White on black', 'wb'], ['Yellow on black', 'yb']] as const).map(([label, value]) => <button className="mc-menu-row" key={value} aria-pressed={cdi.contrast === value} onClick={() => cdi.setContrast(value)}>{label}{cdi.contrast === value && <Check size={20} />}</button>)}
      {page === "size" && ([['Regular', 1], ['Large', 1.2], ['Extra large', 1.4]] as const).map(([label, value]) => <button className="mc-menu-row" key={value} aria-pressed={cdi.scale === value} onClick={() => cdi.setScale(value)}><span style={{ fontSize: `${value}em` }}>{label}</span>{cdi.scale === value && <Check size={20} />}</button>)}
      {page === "instructions" && <div className="mc-instructions"><h3>Listening, Reading and Writing</h3><p>The sections run in order without breaks. The server controls the clock. Closing this page does not pause your exam.</p><p>Listening uses the existing recording, played once. Reading and Writing each have 60 minutes. Follow the word limit and instructions for each question.</p><p>Select a question number to move to it. Use the flag to mark a question for review. Select passage or question text to highlight it or add a note. Notes are temporary exam aids, not submitted answers.</p><p>Answers are saved to your account when confirmed by the server. If a save fails, keep the page open and use Retry save. Speaking is arranged separately with your teacher.</p></div>}
    </div>
  </div>;
}

function MockHeader({ remainingMs, exam = false }: { remainingMs: number | null; exam?: boolean }) {
  const cdi = useMockCdi()!;
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<"connection" | "notifications" | null>(null);
  const [online, setOnline] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const lastMark = useRef<number | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine); update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (remainingMs == null) return;
    const m = Math.ceil(remainingMs / 60000);
    if ([10, 5, 1].includes(m) && lastMark.current !== m) { lastMark.current = m; setAnnouncement(`${m} minute${m === 1 ? "" : "s"} remaining`); }
  }, [remainingMs]);
  return <><header className="mc-topbar"><div className="mc-brand"><span className="mc-logo">IELTS<span>™</span></span><div><div className="mc-candidate">Averna Full Mock</div><div className={`mc-timer ${remainingMs != null && remainingMs <= 300000 ? "mc-low" : ""}`} role="timer" aria-label={remainingMs != null ? `Time remaining ${formatClock(remainingMs)}` : "Exam not started"}>{remainingMs != null ? `${formatClock(remainingMs)} remaining` : "Listening, Reading and Writing"}</div></div></div><div className="mc-top-right">
    {exam && <button className="mc-icon" onClick={() => cdi.setNotesOpen(!cdi.notesOpen)} aria-label="Notes" aria-pressed={cdi.notesOpen}><Pencil size={21} /></button>}
    <button className="mc-icon" onClick={() => setNotice(notice === "connection" ? null : "connection")} aria-label="Connection" aria-expanded={notice === "connection"}><Wifi size={22} /></button>
    <button className="mc-icon" onClick={() => setNotice(notice === "notifications" ? null : "notifications")} aria-label="Notifications" aria-expanded={notice === "notifications"}><Bell size={22} /></button>
    <button className="mc-icon" onClick={() => { setNotice(null); setMenu(true); }} aria-label="Options"><Menu size={23} /></button>
  </div></header><span className="sr-only" aria-live="assertive">{announcement}</span>
  {notice && <div className="mc-notice" role="status">{notice === "connection" ? online ? "Your device is online. Account save status is shown below the exam." : "Your device is offline. Keep this page open; check the save status below." : "Exam notices and save warnings appear in the exam screen."}<button className="mc-icon" aria-label="Close notification" onClick={() => setNotice(null)}><X size={18} /></button></div>}
  {menu && <MockOptions close={() => setMenu(false)} />}</>;
}

export function MockCdiIntro({ sections, active, busy, ready, error, onBegin, children }: { sections: MockView["sections"]; active: number; busy: boolean; ready: boolean; error: string | null; onBegin: () => void; children: ReactNode }) {
  return <div className="mc-screen mc-intro"><MockHeader remainingMs={null} /><main className="mc-home"><div className="mc-home-inner"><section className="mc-test-card"><h1>Averna Full Mock – Listening, Reading and Writing</h1><p>Complete the sound check before you begin. The next section starts automatically.</p></section>
    {sections.map((section, index) => <section className="mc-test-card" key={section.skill}><h2>{section.title}</h2><p className={`mc-status ${section.status === "done" ? "mc-done" : ""}`}>{section.status === "done" ? "Completed" : "Not completed"}</p><p className="mc-timing">{section.detail} · {section.minutes} minutes</p>
      {index === active ? <>{children}<button className="mc-start" onClick={onBegin} disabled={busy || !ready}><ArrowRight size={18} />{busy ? `Starting ${section.title}…` : `Start ${section.title}`}</button>{error && <p className="mc-error" role="alert">{error}</p>}</> : <><div className="mc-info-line">▾ Test information. {index > active ? "Starts automatically after the previous section." : "Section completed."}</div><button className="mc-start" disabled><ArrowRight size={18} />Start {section.title}</button></>}
    </section>)}<p className="mc-muted">The clock starts only when you start Listening. No overall band is shown without Speaking.</p></div></main></div>;
}

function textRange(anchor: HTMLElement, from: number, to: number): Range | null {
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
  const r = document.createRange(); let offset = 0; let begun = false; let n: Node | null;
  while ((n = walker.nextNode())) {
    const len = n.textContent?.length ?? 0;
    if (!begun && from < offset + len) { r.setStart(n, from - offset); begun = true; }
    if (begun && to <= offset + len) { r.setEnd(n, to - offset); return r; }
    offset += len;
  }
  return null;
}

type HighlightApi = { highlights?: Map<string, unknown> };
function MockAnnotations({ body, namespace }: { body: React.RefObject<HTMLDivElement | null>; namespace: string }) {
  const cdi = useMockCdi()!;
  const [selection, setSelection] = useState<{ annotation: Omit<Annotation, "id" | "note">; x: number; y: number } | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    const select = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) { setSelection(null); return; }
      const range = s.getRangeAt(0);
      const start = range.startContainer.parentElement;
      const anchor = start?.closest<HTMLElement>("[data-cdi-anchor]");
      if (!anchor || !body.current?.contains(anchor) || !anchor.contains(range.endContainer) || start?.closest("input,textarea,select,button")) { setSelection(null); return; }
      const quote = range.toString(); if (!quote.trim() || quote.length > 5000) { setSelection(null); return; }
      const prefix = range.cloneRange(); prefix.selectNodeContents(anchor); prefix.setEnd(range.startContainer, range.startOffset);
      const from = prefix.toString().length; const rect = range.getBoundingClientRect();
      setSelection({ annotation: { anchor: `${namespace}:${anchor.dataset.cdiAnchor}`, from, to: from + quote.length, quote }, x: Math.max(8, Math.min(window.innerWidth - 244, rect.left)), y: Math.max(62, Math.min(window.innerHeight - 140, rect.bottom + 8)) });
    };
    document.addEventListener("selectionchange", select);
    const scroll = () => setSelection(null); window.addEventListener("resize", scroll); body.current?.addEventListener("scroll", scroll, true);
    const node = body.current;
    return () => { document.removeEventListener("selectionchange", select); window.removeEventListener("resize", scroll); node?.removeEventListener("scroll", scroll, true); };
  }, [body, namespace]);
  useEffect(() => {
    if (typeof CSS === "undefined") return;
    const api = CSS as typeof CSS & HighlightApi;
    const Constructor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!api.highlights || !Constructor || !body.current) return;
    const render = () => {
      const ranges: Range[] = [];
      body.current?.querySelectorAll<HTMLElement>("[data-cdi-anchor]").forEach(anchor => {
        for (const n of cdi.notes.filter(n => n.anchor === `${namespace}:${anchor.dataset.cdiAnchor}`)) {
          const r = textRange(anchor, n.from, n.to); if (r?.toString() === n.quote) ranges.push(r);
        }
      });
      api.highlights!.set("averna-mock-cdi", new Constructor(...ranges));
    };
    render(); const observer = new MutationObserver(render); observer.observe(body.current, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); api.highlights?.delete("averna-mock-cdi"); };
  }, [body, namespace, cdi.notes]);
  const add = (note: boolean) => {
    if (!selection) return;
    if (!note && (typeof CSS === "undefined" || !(CSS as typeof CSS & HighlightApi).highlights)) { setUnsupported(true); return; }
    const entry: Annotation = { ...selection.annotation, id: crypto.randomUUID(), note: note ? "" : null };
    cdi.setNotes(all => [...all, entry]); if (note) cdi.setNotesOpen(true);
    window.getSelection()?.removeAllRanges(); setSelection(null);
  };
  return <>{selection && <div className="mc-selection" role="toolbar" aria-label="Selected text" style={{ left: selection.x, top: selection.y }} onMouseDown={e => e.preventDefault()}><button onClick={() => add(true)}>Note</button><button onClick={() => add(false)}>Highlight</button><button onClick={() => { const a = selection.annotation; cdi.setNotes(all => all.filter(n => n.anchor !== a.anchor || n.to <= a.from || n.from >= a.to)); window.getSelection()?.removeAllRanges(); setSelection(null); }}>Clear</button></div>}
    {unsupported && <div className="mc-notice" role="status">Highlighting is unavailable in this browser. You can still add notes.<button className="mc-icon" onClick={() => setUnsupported(false)} aria-label="Close highlight message"><X size={18} /></button></div>}
    {cdi.notesOpen && <aside className="mc-notes" aria-label="Exam notes"><header><h2>Notes</h2><button className="mc-icon" onClick={() => cdi.setNotesOpen(false)} aria-label="Close notes"><X size={20} /></button></header><p>Temporary notes · not submitted as answers</p>{!cdi.notes.some(n => n.note !== null) && <p>Select text, then choose Note to add a note.</p>}{cdi.notes.filter(n => n.note !== null).map(n => <section key={n.id}><blockquote>{n.quote}</blockquote><textarea aria-label={`Note about ${n.quote.slice(0, 50)}`} value={n.note ?? ""} onChange={e => cdi.setNotes(all => all.map(a => a.id === n.id ? { ...a, note: e.target.value } : a))} /><button className="mc-secondary" onClick={() => cdi.setNotes(all => all.filter(a => a.id !== n.id))}>Delete note</button></section>)}</aside>}
  </>;
}

export function MockCdiShell(props: ExamShellProps) {
  const cdi = useMockCdi()!;
  const { parts, activePart, answered, flagged, current, left, children, remainingMs, onPartChange, onJump, onSubmit, submitting } = props;
  const [review, setReview] = useState(false);
  const [mobilePane, setMobilePane] = useState<"left" | "right">(left ? "left" : "right");
  const [split, setSplit] = useState(50);
  const body = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  useDialogFocus(review, reviewRef, () => setReview(false));
  const numbers = parts.flatMap(p => p.numbers);
  const index = current == null ? -1 : numbers.indexOf(current);
  const isWriting = props.itemLabel === "tasks";
  const namespace = isWriting ? "writing" : props.title.toLowerCase().includes("listening") ? "listening" : "reading";
  const active = parts[activePart];
  const jump = (n: number) => { onJump(n); setMobilePane("right"); };
  const resize = (clientX: number) => { const rect = body.current?.getBoundingClientRect(); if (rect) setSplit(Math.max(28, Math.min(72, ((clientX - rect.left) / rect.width) * 100))); };
  return <div className={`mc-screen mc-exam mc-${namespace}`} data-testid="mock-cdi-shell"><MockHeader remainingMs={remainingMs} exam />
    <div className="mc-banner"><b>{active?.title}</b><span>{isWriting ? "Write your answer in the space provided." : `Questions ${active?.numbers[0] ?? ""}–${active?.numbers.at(-1) ?? ""}`}</span></div>
    {left && <div className="mc-mobile-tabs" role="tablist" aria-label="Exam panes"><button role="tab" aria-selected={mobilePane === "left"} onClick={() => setMobilePane("left")}>{props.leftLabel ?? (isWriting ? active?.title : "Passage")}</button><button role="tab" aria-selected={mobilePane === "right"} onClick={() => setMobilePane("right")}>{props.rightLabel ?? (isWriting ? "Your answer" : "Questions")}</button></div>}
    <div ref={body} className="mc-body" style={{ "--mc-split": `${split}%` } as CSSProperties}>
      {left && <><div className={`mc-pane mc-left ${mobilePane === "left" ? "mc-mobile-active" : ""}`} data-cdi-anchor={`${activePart}-left`}>{left}</div><div className="mc-splitter" role="separator" aria-label="Resize exam panes" aria-orientation="vertical" tabIndex={0} aria-valuemin={28} aria-valuemax={72} aria-valuenow={Math.round(split)} onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setSplit(s => Math.max(28, Math.min(72, s + (e.key === "ArrowLeft" ? -2 : 2)))); } }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); resize(e.clientX); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) resize(e.clientX); }} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}><span>↔</span></div></>}
      <div className={`mc-pane mc-right ${!left ? "mc-single" : ""} ${mobilePane === "right" ? "mc-mobile-active" : ""}`} data-cdi-anchor={`${activePart}-right`}><div className="mc-content">{children}</div></div>
    </div>
    <div className="mc-status-area"><MockSaveStatus />{props.headerExtra}{props.footerExtra}</div>
    <div className="mc-arrows"><button onClick={() => index > 0 && jump(numbers[index - 1])} disabled={index <= 0} aria-label="Previous question"><ArrowLeft size={25} /></button><button onClick={() => index < numbers.length - 1 && jump(numbers[index + 1])} disabled={index >= numbers.length - 1} aria-label="Next question"><ArrowRight size={25} /></button></div>
    <footer className="mc-footer"><nav aria-label="Question navigation">{parts.map((part, i) => <div key={i} className={`mc-part ${i === activePart ? "mc-part-active" : ""}`}><button className="mc-part-title" aria-current={i === activePart ? "step" : undefined} onClick={() => onPartChange(i)}><b>{part.title}</b><span>{props.partSummaries?.[i] ?? `${part.numbers.filter(n => answered.has(n)).length} of ${part.numbers.length}`}</span></button>{i === activePart && !isWriting && <div className="mc-numbers">{part.numbers.map(n => <button key={n} aria-label={`Question ${n}${answered.has(n) ? ", answered" : ", unanswered"}${flagged.has(n) ? ", flagged" : ""}`} aria-current={current === n ? "true" : undefined} className={`${answered.has(n) ? "mc-answered" : ""} ${flagged.has(n) ? "mc-flagged" : ""}`} onClick={() => jump(n)}><span>{n}</span></button>)}</div>}</div>)}</nav><button className="mc-finish" onClick={() => setReview(true)} disabled={submitting}>Finish</button></footer>
    <MockAnnotations body={body} namespace={namespace} />
    {review && <div ref={reviewRef}><ReviewDialog parts={parts} answered={answered} flagged={flagged} onClose={() => setReview(false)} onConfirm={() => { void onSubmit(); setReview(false); }} onJump={n => { jump(n); setReview(false); }} submitting={submitting} submitLabel={props.submitLabel ?? "Finish Test"} description={props.reviewDescription} /></div>}
  </div>;
}
