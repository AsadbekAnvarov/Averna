"use client";

/**
 * «Qismlar chegaralari»: staff confirm where Parts 1–4 of a supplied whole
 * recording start and end (Audio_Manager, Uzbek UI). The recording is
 * downloaded once by this browser (directly from the host), checked against
 * the paper's SHA-256 and indexed frame by frame; «Chegarani tinglash» plays
 * the exact frames around a boundary (b − 5 s … b + 5 s) — the very cut
 * students will hear — and «Tasdiqlash» sends the segments with their frame
 * and byte ranges. Moving a boundary by ±0,1 s never calls the server.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Headphones, Loader2, Minus, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoundaryInfo } from "@/lib/ielts/audio/admin-types";
import { buildClip, indexMp3, type Mp3Index } from "@/lib/ielts/audio/mp3-index";
import {
  formatClock,
  parseClock,
  segmentRanges,
  segmentsFromBoundaries,
  validateSegments,
} from "@/lib/ielts/segments";
import { segmentMessage } from "@/lib/ielts/segments-messages";

const SAVE_TIMEOUT_MS = 30_000;
const LISTEN_HALF_MS = 5_000;
const NUDGE_MS = 100;

const BTN = "min-h-[44px] min-w-[44px] border border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white";
const BTN_PRIMARY = "min-h-[44px] neon-button bg-averna-primary text-white hover:bg-averna-light";
const FIELD =
  "h-11 w-full min-w-0 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm tabular-nums text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

type Note = { tone: "ok" | "error" | "info"; text: string } | null;
type Loaded = { bytes: Uint8Array; index: Mp3Index };

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function whenText(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Text of the three inner boundaries as the fields show them. */
export function boundaryFields(info: Pick<BoundaryInfo, "boundaries">): [string, string, string] {
  const f = (v: number | null) => (v == null ? "" : formatClock(v));
  return [f(info.boundaries[0]), f(info.boundaries[1]), f(info.boundaries[2])];
}

/** The frames from b − 5 s to b + 5 s of an indexed recording, as a playable clip (null when it can't be built). */
export function listenClip(loaded: Loaded, boundaryMs: number): Uint8Array | null {
  const { index, bytes } = loaded;
  const a = Math.max(0, Math.round((boundaryMs - LISTEN_HALF_MS) / index.frameMs));
  const b = Math.min(index.frames, Math.round((boundaryMs + LISTEN_HALF_MS) / index.frameMs));
  if (b <= a) return null;
  return buildClip(bytes.subarray(index.offsets[a], index.offsets[b]), b - a, index.format);
}

export function ListeningBoundaries({
  testId,
  title,
  info,
  onSaved,
}: {
  testId: string;
  title: string;
  info: BoundaryInfo;
  onSaved: (next: BoundaryInfo) => void;
}) {
  const [values, setValues] = useState<[string, string, string]>(() => boundaryFields(info));
  const [note, setNote] = useState<Note>(null);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [recordingBad, setRecordingBad] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef<Loaded | null>(null);
  const loadingRef = useRef<Promise<Loaded | null> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipUrlRef = useRef<string | null>(null);

  // A new revision from the server (after a save or a reload) replaces the fields.
  useEffect(() => {
    setValues(boundaryFields(info));
  }, [info]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    },
    [],
  );

  async function loadRecording(): Promise<Loaded | null> {
    if (loadedRef.current) return loadedRef.current;
    if (loadingRef.current) return loadingRef.current;
    const run = (async () => {
      setLoadPct(0);
      try {
        const res = await fetch(info.url, { mode: "cors", credentials: "omit" });
        if (!res.ok || res.type === "opaque") throw new Error("unreadable");
        const total = Number(res.headers.get("content-length")) || info.bytes || 0;
        let bytes: Uint8Array;
        const reader = res.body?.getReader?.();
        if (reader) {
          const chunks: Uint8Array[] = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            chunks.push(value);
            got += value.length;
            if (total > 0) setLoadPct(Math.min(99, Math.floor((got * 100) / total)));
          }
          bytes = new Uint8Array(got);
          let at = 0;
          for (const c of chunks) {
            bytes.set(c, at);
            at += c.length;
          }
        } else bytes = new Uint8Array(await res.arrayBuffer());
        const digest = hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
        if (digest !== info.recordingSha256) throw new Error("sha");
        const index = indexMp3(bytes);
        if (Math.abs(index.durationMs - info.durationMs) > 1000) throw new Error("duration");
        const loaded = { bytes, index };
        loadedRef.current = loaded;
        return loaded;
      } catch {
        setRecordingBad(true);
        setNote({ tone: "error", text: segmentMessage("recording") });
        return null;
      } finally {
        setLoadPct(null);
        loadingRef.current = null;
      }
    })();
    loadingRef.current = run;
    return run;
  }

  function parsed(k: number): number | null | "empty" {
    const v = values[k].trim();
    if (!v) return "empty";
    return parseClock(v);
  }

  function nudge(k: number, delta: number) {
    const v = parsed(k);
    if (v === "empty" || v == null) {
      setNote({ tone: "error", text: v === "empty" ? segmentMessage("empty", k + 1) : segmentMessage("format") });
      return;
    }
    const next = Math.min(info.durationMs, Math.max(0, v + delta));
    setValues((prev) => {
      const out = [...prev] as [string, string, string];
      out[k] = formatClock(next);
      return out;
    });
    setNote(null);
  }

  async function listen(k: number) {
    const v = parsed(k);
    if (v === "empty" || v == null) {
      setNote({ tone: "error", text: v === "empty" ? segmentMessage("empty", k + 1) : segmentMessage("format") });
      return;
    }
    const loaded = await loadRecording();
    if (!loaded) return;
    const clip = listenClip(loaded, v);
    if (!clip) {
      setNote({ tone: "error", text: segmentMessage("recording") });
      return;
    }
    audioRef.current?.pause();
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    const url = URL.createObjectURL(new Blob([clip as BlobPart], { type: "audio/mpeg" }));
    clipUrlRef.current = url;
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.src = url;
    void el.play().catch(() => setNote({ tone: "error", text: segmentMessage("recording") }));
  }

  async function confirm() {
    const ms: number[] = [];
    for (let k = 0; k < 3; k++) {
      const v = parsed(k);
      if (v === "empty") return setNote({ tone: "error", text: segmentMessage("empty", k + 1) });
      if (v == null) return setNote({ tone: "error", text: segmentMessage("format") });
      ms.push(v);
    }
    const segments = segmentsFromBoundaries([ms[0], ms[1], ms[2]], info.durationMs);
    const violation = validateSegments(segments, { durationMs: info.durationMs, windowsByPart: info.windowsByPart });
    if (violation) return setNote({ tone: "error", text: segmentMessage(violation.rule, violation.part) });
    const loaded = await loadRecording();
    if (!loaded) return;
    const ranges = segmentRanges(loaded.index, segments);
    setSaving(true);
    setNote(null);
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/admin/listening-audio/segments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          testId,
          revision: info.revision,
          confirm: true,
          segments,
          index: {
            fileSha256: info.recordingSha256,
            sampleRate: loaded.index.format.sampleRate,
            samplesPerFrame: loaded.index.format.samplesPerFrame,
            ranges,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string; boundaries?: BoundaryInfo | null } | null;
      if (!res.ok) {
        setNote({ tone: "error", text: data?.error || segmentMessage("server") });
        return;
      }
      setNote({ tone: "ok", text: data?.message || segmentMessage("saved") });
      if (data?.boundaries) onSaved(data.boundaries);
    } catch {
      setNote({ tone: "error", text: segmentMessage("network") });
    } finally {
      window.clearTimeout(timer);
      setSaving(false);
    }
  }

  // Part rows from the current field values (a row shows "—" until both its ends are valid).
  const cuts: (number | null)[] = [0, ...values.map((v) => parseClock(v)), info.durationMs];
  const verified = info.status === "verified";
  const busy = saving || loadPct != null;

  return (
    <section aria-labelledby={`seg-${testId}`} className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`seg-${testId}`} className="text-sm font-semibold text-white">
          Qismlar chegaralari
        </h4>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-averna-neon">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Tasdiqlangan{info.verifiedBy ? ` · ${info.verifiedBy}` : ""}
            {info.verifiedAt ? `, ${whenText(info.verifiedAt)}` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-200">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Tasdiqlanmagan
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">
        {info.source === "candidates"
          ? "Qiymatlar import paytida avtomatik taklif qilingan. Har bir chegarani tinglab, keyin tasdiqlang."
          : info.source === "empty"
            ? "Chegaralar hali kiritilmagan. Oʻquvchilar bu testni faqat toʻliq ishlaydi."
            : "Saqlangan chegaralar."}
      </p>

      <ol className="mt-3 grid gap-1 text-sm text-gray-200 sm:grid-cols-2" aria-label="Qismlar">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="tabular-nums">
            Part {i + 1}: {cuts[i] != null ? formatClock(cuts[i]!) : "—"} – {cuts[i + 1] != null ? formatClock(cuts[i + 1]!) : "—"}
          </li>
        ))}
      </ol>

      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-gray-300">
              Part {k + 1} → Part {k + 2} chegarasi
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="mm:ss.d"
                value={values[k]}
                onChange={(e) => {
                  const v = e.target.value;
                  setValues((prev) => {
                    const out = [...prev] as [string, string, string];
                    out[k] = v;
                    return out;
                  });
                }}
                className={cn(FIELD, "mt-1")}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => nudge(k, -NUDGE_MS)} aria-label="Chegarani 0,1 soniya orqaga surish" className={BTN}>
                <Minus className="mr-1 h-3.5 w-3.5" aria-hidden />
                0,1 s
              </Button>
              <Button type="button" size="sm" onClick={() => nudge(k, NUDGE_MS)} aria-label="Chegarani 0,1 soniya oldinga surish" className={BTN}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                0,1 s
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void listen(k)}
                disabled={busy || recordingBad}
                aria-label={`${title}: Part ${k + 1} → Part ${k + 2} chegarasini tinglash`}
                className={BTN}
              >
                <Headphones className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Chegarani tinglash
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void confirm()} disabled={busy || recordingBad} className={BTN_PRIMARY}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
          Tasdiqlash
        </Button>
        {loadPct != null && (
          <span className="text-xs tabular-nums text-gray-300" role="status">
            Yozuv yuklanmoqda… {loadPct}%
          </span>
        )}
      </div>
      {note && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className={cn("mt-2 text-sm", note.tone === "ok" ? "text-averna-neon" : note.tone === "error" ? "text-red-200" : "text-gray-300")}
        >
          {note.text}
        </p>
      )}
    </section>
  );
}
