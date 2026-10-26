"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Lock, MessageSquareHeart, Star } from "lucide-react";
import {
  CRITERIA,
  CRITERION_INFO,
  NOTE_MAX,
  STRENGTHS,
  TIPS,
  checkNote,
  type Criterion,
  type FeedbackDto,
  type Preset,
} from "@/lib/speaking/feedback-presets";
import { nextStepFor, type OwnFluency } from "@/lib/speaking/next-step";

/**
 * Peer feedback on the done screen (docs/peer-speaking.md, Phase C) — "give to get":
 * rate the partner on the four criteria (1–5), pick a strength and a tip, send; then the
 * partner's feedback for you is revealed (polled every 5 s for up to 2 min while waiting)
 * with "Your next step".
 */

export const FEEDBACK_POLL_MS = 5000;
export const FEEDBACK_WAIT_MS = 120_000;

type Received = FeedbackDto | { locked: true; partnerSubmitted: boolean } | null;
interface FeedbackState {
  allowed: boolean;
  mine: FeedbackDto | null;
  received: Received;
}

const isDto = (r: Received): r is FeedbackDto => !!r && !("locked" in r);

const btn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function StarRating({ criterion, value, onChange }: { criterion: Criterion; value: number; onChange: (v: number) => void }) {
  const info = CRITERION_INFO[criterion];
  const name = useId();
  return (
    <fieldset className="rounded-xl border border-white/10 p-3">
      <legend className="px-1 text-sm font-semibold text-white">
        {info.title} <span className="font-normal text-gray-400">· {info.hint}</span>
      </legend>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg focus-within:ring-2 focus-within:ring-averna-cyan">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={`${n} of 5 — ${info.levels[n - 1]}`}
              className="peer sr-only"
            />
            <Star className={`h-7 w-7 ${n <= value ? "fill-yellow-300 text-yellow-300" : "text-gray-500"}`} aria-hidden />
          </label>
        ))}
      </div>
      <p className="mt-1 min-h-[1.25rem] text-xs text-gray-300" aria-live="polite">
        {value ? info.levels[value - 1] : "Tap a star"}
      </p>
    </fieldset>
  );
}

function Chips({ label, options, value, onChange }: { label: string; options: Preset[]; value: string | null; onChange: (id: string | null) => void }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="text-sm font-semibold text-white">
        {label} <span className="font-normal text-gray-400">(optional)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(value === o.id ? null : o.id)}
            className={`min-h-[44px] rounded-full border px-3 text-sm ${
              value === o.id ? "border-averna-pink bg-averna-pink/15 text-white" : "border-white/15 text-gray-200 hover:border-white/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Ratings({ f, title }: { f: FeedbackDto; title: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CRITERIA.map((c) => (
          <div key={c} className="rounded-lg border border-white/10 px-3 py-2">
            <dt className="text-xs text-gray-400">{CRITERION_INFO[c].title}</dt>
            <dd className="text-sm font-semibold text-white">
              <span aria-hidden>{"★".repeat(f[c])}</span>
              <span className="sr-only">{f[c]} of 5</span> <span className="text-xs font-normal text-gray-300">{f[c]}/5</span>
            </dd>
          </div>
        ))}
      </dl>
      {(f.strength || f.tip || f.note) && (
        <ul className="mt-2 space-y-1 text-sm text-gray-200">
          {f.strength && <li>Strength: {f.strength.label}</li>}
          {f.tip && <li>Tip: {f.tip.label}</li>}
          {f.note && <li>“{f.note}”</li>}
        </ul>
      )}
    </div>
  );
}

export function PeerFeedback({ roomId, partnerName, own }: { roomId: string; partnerName: string; own: OwnFluency | null }) {
  const [data, setData] = useState<FeedbackState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [ratings, setRatings] = useState<Record<Criterion, number>>({ fluency: 0, lexical: 0, grammar: 0, pronunciation: 0 });
  const [strength, setStrength] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const noteId = useId();
  const waitStart = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/speaking/feedback?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const d = (await res.json().catch(() => ({}))) as Partial<FeedbackState> & { error?: string };
      if (!res.ok) {
        setLoadError(d.error || "Feedback isn't available right now.");
        return;
      }
      setLoadError("");
      setData({ allowed: !!d.allowed, mine: d.mine ?? null, received: d.received ?? null });
    } catch {
      setLoadError("Connection problem. Feedback will load when you're back online.");
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // After sending: poll every 5 s for the partner's feedback, for up to 2 minutes.
  const waiting = !!data?.mine && !isDto(data.received);
  useEffect(() => {
    if (!waiting || gaveUp) return;
    if (waitStart.current === null) waitStart.current = Date.now();
    const id = setInterval(() => {
      if (Date.now() - (waitStart.current ?? 0) >= FEEDBACK_WAIT_MS) {
        setGaveUp(true);
        return;
      }
      void load();
    }, FEEDBACK_POLL_MS);
    return () => clearInterval(id);
  }, [waiting, gaveUp, load]);

  const complete = CRITERIA.every((c) => ratings[c] > 0);
  const noteCheck = checkNote(note);

  const send = async () => {
    if (!complete || sending) return;
    if (!noteCheck.ok) {
      setError(noteCheck.error);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/speaking/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, ...ratings, strength, tip, note: noteCheck.note }),
      });
      const d = (await res.json().catch(() => ({}))) as Partial<FeedbackState> & { error?: string };
      if (res.ok || (res.status === 409 && d.mine)) setData({ allowed: true, mine: d.mine ?? null, received: d.received ?? null });
      else setError(d.error || "Feedback couldn't be sent. Try again.");
    } catch {
      setError("Connection problem. Check your internet and try again.");
    } finally {
      setSending(false);
    }
  };

  const heading = (
    <p className="flex items-center gap-2 text-base font-semibold text-white">
      <MessageSquareHeart className="h-5 w-5 text-averna-pink" aria-hidden /> Feedback for {partnerName}
    </p>
  );

  if (!data) {
    return (
      <section aria-label="Peer feedback" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
        {heading}
        <p className="mt-1" role={loadError ? "alert" : "status"}>
          {loadError || "Loading feedback…"}
        </p>
      </section>
    );
  }
  if (!data.allowed && !data.mine) {
    return (
      <section aria-label="Peer feedback" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
        {heading}
        <p className="mt-1">Feedback opens for sessions that got started. Next time, start the first part together.</p>
      </section>
    );
  }

  // The partner's ratings drive the next step; without them (after the wait) only own caption stats can.
  const shownStep = isDto(data.received) ? nextStepFor(data.received, own) : data.mine && gaveUp ? nextStepFor(null, own) : null;

  return (
    <section aria-label="Peer feedback" className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      {heading}
      {!data.mine ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="space-y-3"
        >
          <p className="flex items-start gap-2 text-sm text-gray-300">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {data.received && "locked" in data.received && data.received.partnerSubmitted
              ? `${partnerName} has sent you feedback. Send yours to see it.`
              : `Give feedback to get feedback: you'll see ${partnerName}'s feedback for you after you send yours.`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <StarRating key={c} criterion={c} value={ratings[c]} onChange={(v) => setRatings((r) => ({ ...r, [c]: v }))} />
            ))}
          </div>
          <Chips label={`What did ${partnerName} do well?`} options={STRENGTHS} value={strength} onChange={setStrength} />
          <Chips label={`One tip for ${partnerName}`} options={TIPS} value={tip} onChange={setTip} />
          <div>
            <label htmlFor={noteId} className="text-sm font-semibold text-white">
              Anything else? <span className="font-normal text-gray-400">(optional, no links or contacts)</span>
            </label>
            <input
              id={noteId}
              type="text"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-white/15 bg-background/50 px-3 text-sm text-white"
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">
              {note.trim().length}/{NOTE_MAX}
            </p>
          </div>
          <button type="submit" disabled={!complete || sending} className={`${btn} bg-averna-primary text-white hover:bg-averna-light`}>
            {sending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />} Send feedback
          </button>
          {!complete && <p className="text-xs text-gray-400">Rate all four to send.</p>}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
        </form>
      ) : (
        <>
          <p role="status" className="text-sm text-averna-neon">
            Thanks — your feedback was sent to {partnerName}.
          </p>
          {isDto(data.received) ? (
            <Ratings f={data.received} title={`${partnerName}'s feedback for you`} />
          ) : (
            <p role="status" className="flex items-center gap-2 text-sm text-gray-300">
              {!gaveUp && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {gaveUp
                ? `${partnerName} hasn't sent feedback yet. It will show on your Speaking page when they do.`
                : `Waiting for ${partnerName}'s feedback…`}
            </p>
          )}
        </>
      )}
      {shownStep && (
        <div className="rounded-xl border border-averna-cyan/40 bg-averna-cyan/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-averna-cyan">Your next step</p>
          <p className="mt-1 text-sm font-semibold text-white">{shownStep.title}</p>
          <p className="mt-1 text-sm text-gray-200">{shownStep.text}</p>
          <Link href={shownStep.href} className={`${btn} mt-2 border border-white/20 text-white hover:bg-white/10`}>
            {shownStep.linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
