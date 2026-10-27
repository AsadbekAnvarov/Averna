"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CloudOff, PartyPopper, RotateCcw, Volume2 } from "lucide-react";
import { intervalHint, loadSrs, saveSrs, type Rating, type SrsMap } from "@/lib/srs";
import type { FlashcardsPack } from "@/lib/offline/packs";
import { queueGrade } from "@/lib/offline/queue-store";
import { updatePack } from "@/lib/offline/store";
import { gradeOffline, nextDueAt, studyQueue } from "@/lib/offline/study";
import { syncInBackground, syncLabel, useSyncStatus } from "./use-offline";

const RATINGS: { key: Rating; label: string; cls: string }[] = [
  { key: "again", label: "Again", cls: "border-red-500/50 text-red-300 hover:bg-red-500/10" },
  { key: "hard", label: "Hard", cls: "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" },
  { key: "good", label: "Good", cls: "border-averna-cyan/50 text-averna-cyan hover:bg-averna-cyan/10" },
  { key: "easy", label: "Easy", cls: "border-averna-neon/50 text-averna-neon hover:bg-averna-neon/10" },
];

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  window.speechSynthesis.speak(u);
}

/** The pack's review state, with this device's newer state for its cards (one map for online and offline study). */
function startingState(pack: FlashcardsPack): SrsMap {
  const local = loadSrs();
  const out: SrsMap = { ...pack.srs };
  for (const c of pack.cards) if (local[c.key]) out[c.key] = local[c.key];
  return out;
}

/**
 * Studying a saved flashcard pack with no connection (idea 7): the same spaced-repetition
 * schedule as online (lib/srs.ts), applied on the device; each grade waits in the queue
 * with its moment and syncs when the connection is back.
 */
export function OfflineStudy({ pack, onBack }: { pack: FlashcardsPack; onBack: () => void }) {
  const sync = useSyncStatus(pack.ownerId);
  const srsRef = useRef<SrsMap>(startingState(pack));
  const [queue, setQueue] = useState(() => studyQueue(pack.cards, srsRef.current, Date.now()));
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const current = queue[0];
  const nextDue = useMemo(() => (queue.length ? null : nextDueAt(pack.cards, srsRef.current)), [queue.length, pack.cards]);

  const rate = (rating: Rating) => {
    if (!current) return;
    const at = Date.now();
    const { next, srs } = gradeOffline(srsRef.current, current.key, rating, at);
    srsRef.current = srs;
    const local = loadSrs();
    local[current.key] = next;
    saveSrs(local);
    queueGrade({ ownerId: pack.ownerId, itemKey: current.key, rating, source: "vocab", reviewedAt: at });
    void updatePack({ ...pack, srs });
    if (navigator.onLine !== false) syncInBackground(pack.ownerId);
    setReviewed((n) => n + 1);
    setFlipped(false);
    setQueue((q) => {
      const [, ...rest] = q;
      return rating === "again" ? [...rest, current] : rest;
    });
  };

  return (
    <section aria-labelledby="offline-study-title">
      <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-sm font-medium text-gray-300 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Saved on this device
      </button>
      <h1 id="offline-study-title" className="text-2xl font-bold text-white">{pack.title}</h1>
      <p className="mt-1 text-sm text-gray-400">Same review schedule as online. Your grades sync when you&apos;re back online.</p>

      <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-gray-400">{queue.length} left</span>
        <span className="flex items-center gap-1 font-semibold text-averna-neon">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {reviewed} reviewed
        </span>
      </div>
      <p role="status" aria-live="polite" className={sync.state ? "mb-3 flex items-center gap-2 text-sm text-amber-200" : "sr-only"}>
        {sync.state && (
          <>
            <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
            {syncLabel(sync.pending, sync.state)}
          </>
        )}
      </p>

      {!current ? (
        <div className="glass rounded-2xl border border-averna-neon/30 px-6 py-12 text-center">
          <PartyPopper className="mx-auto mb-3 h-10 w-10 text-averna-neon" aria-hidden />
          <p className="text-lg font-bold text-white">All caught up</p>
          <p className="mt-2 text-sm text-gray-400">
            {reviewed > 0 ? `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}. ` : "Nothing in this pack is due right now. "}
            {nextDue ? `The next card is due ${new Date(nextDue).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : ""}
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? `${current.word}: ${current.meaning}. Tap to show the word` : `${current.word}. Tap to reveal the meaning`}
            className="glass flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-averna-purple/40 px-6 py-8 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            {flipped ? (
              <>
                <span className="text-lg font-semibold text-averna-cyan">{current.meaning}</span>
                <span className="mt-2 text-sm italic text-gray-300">&ldquo;{current.example}&rdquo;</span>
                <span className="mt-4 border-t border-white/10 pt-3">
                  <span className="block text-xs uppercase tracking-widest text-averna-neon">Oʻzbekcha</span>
                  <span className="block text-base font-medium text-white">{current.uz}</span>
                </span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold text-white">{current.word}</span>
                <span className="mt-4 text-xs text-gray-400">tap to reveal</span>
              </>
            )}
          </button>
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => speak(`${current.word}. ${current.example}`)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-averna-pink hover:bg-white/5">
              <Volume2 className="h-4 w-4" aria-hidden /> Pronounce
            </button>
          </div>
          {flipped ? (
            <div className="mt-3 grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
              {RATINGS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => rate(r.key)}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border bg-white/5 py-2 transition-colors ${r.cls}`}
                >
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-[11px] opacity-80">{intervalHint(srsRef.current[current.key], r.key)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-center text-sm text-gray-400">Recall the meaning, then tap the card to grade yourself.</p>
          )}
        </>
      )}
    </section>
  );
}
