"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ban, Flag, ShieldAlert, X } from "lucide-react";
import { REPORT_NOTE_MAX, REPORT_REASONS, REPORT_REASON_LABEL, SAFETY_COPY, type ReportReason } from "@/lib/speaking/safety";

/**
 * "Report or block" for a peer room (docs/peer-speaking.md, Phase C) — in the room at any
 * time and on the done screen. Block ends an active session for both (`onEnded` gets the
 * ended state to adopt).
 */

const btn =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  roomId: string;
  partnerName: string;
  onEnded?: (state: unknown, version: unknown) => void;
}

export function PeerSafetyMenu({ roomId, partnerName, onEnded }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"report" | "block" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [done, setDone] = useState<{ report?: string; block?: string }>({});
  const [error, setError] = useState("");
  const titleId = useId();
  const noteId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const opener = openerRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, ...body }) });
    const d = (await res.json().catch(() => ({}))) as { error?: string; state?: unknown; version?: unknown };
    return { ok: res.ok, d };
  };

  const report = async () => {
    if (!reason || busy) return;
    setBusy("report");
    setError("");
    try {
      const { ok, d } = await post("/api/speaking/report", { reason, note: note.trim() || undefined });
      if (ok) setDone((x) => ({ ...x, report: "Thanks — your report was sent to your teachers." }));
      else setError(d.error || "The report couldn't be sent. Try again.");
    } catch {
      setError("Connection problem. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const block = async () => {
    if (busy) return;
    setBusy("block");
    setError("");
    try {
      const { ok, d } = await post("/api/speaking/block", {});
      if (ok) {
        setDone((x) => ({ ...x, block: `You blocked ${partnerName}. You won't be matched again.` }));
        setConfirmBlock(false);
        if (d.state) onEnded?.(d.state, d.version);
      } else setError(d.error || "Blocking didn't work. Try again.");
    } catch {
      setError("Connection problem. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)} className={`${btn} border border-white/20 text-gray-200 hover:bg-white/10`}>
        <ShieldAlert className="h-4 w-4" aria-hidden /> <span>Report or block</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="av-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold text-white">
                Report or block {partnerName}
              </h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className={`${btn} px-2 text-gray-300`}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <section aria-label="Report" className="mt-3 space-y-3">
              <p className="text-sm text-gray-300">{SAFETY_COPY.report}</p>
              {done.report ? (
                <p role="status" className="text-sm text-averna-neon">
                  {done.report}
                </p>
              ) : (
                <>
                  <fieldset>
                    <legend className="text-sm font-semibold text-white">What happened?</legend>
                    <div className="mt-2 space-y-1">
                      {REPORT_REASONS.map((r) => (
                        <label key={r} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-3 text-sm text-white">
                          <input type="radio" name={`${titleId}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-averna-pink" />
                          {REPORT_REASON_LABEL[r]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label htmlFor={noteId} className="text-sm font-semibold text-white">
                      Details <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      id={noteId}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={REPORT_NOTE_MAX}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-background/50 p-2 text-sm text-white"
                    />
                  </div>
                  <button type="button" onClick={() => void report()} disabled={!reason || !!busy} className={`${btn} bg-averna-primary text-white`}>
                    <Flag className="h-4 w-4" aria-hidden /> Send report
                  </button>
                </>
              )}
            </section>

            <section aria-label="Block" className="mt-5 space-y-3 border-t border-white/10 pt-4">
              <p className="text-sm text-gray-300">{SAFETY_COPY.block}</p>
              {done.block ? (
                <p role="status" className="text-sm text-averna-neon">
                  {done.block}
                </p>
              ) : confirmBlock ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConfirmBlock(false)} className={`${btn} border border-white/20 text-white`}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void block()} disabled={!!busy} className={`${btn} bg-red-500 text-white hover:bg-red-600`}>
                    <Ban className="h-4 w-4" aria-hidden /> Yes, block {partnerName}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmBlock(true)} className={`${btn} border border-red-400/50 text-red-300 hover:bg-red-500/10`}>
                  <Ban className="h-4 w-4" aria-hidden /> Block {partnerName}
                </button>
              )}
            </section>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
