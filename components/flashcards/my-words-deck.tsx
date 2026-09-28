"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, BookMarked, Loader2, PartyPopper, RotateCcw, Sparkles, Trash2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DICT_LANG_LABEL, markHeadword, type DictEntry, type SavedWord } from "@/lib/dictionary-core";
import { intervalHint, isDue, type Rating } from "@/lib/srs";
import { canSpeak, speakEnglish, stopSpeaking } from "@/components/dictionary/client";
import { isFreshCard, type MyWordsState } from "./use-my-words";

/**
 * "My words" — the words a student saved from the in-text dictionary, as a
 * spaced-repetition deck. Front: the headword and its example with the word in
 * bold. Back: IPA, definition and translation. Ratings use the same SM-2
 * schedule (and server ledger) as the other decks.
 */

const MAX_SESSION = 50;
const DAY = 86_400_000;

const RATINGS: { key: Rating; label: string; shortcut: string; cls: string }[] = [
  { key: "again", label: "Again", shortcut: "1", cls: "border-red-500/50 text-red-300 hover:bg-red-500/10" },
  { key: "hard", label: "Hard", shortcut: "2", cls: "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" },
  { key: "good", label: "Good", shortcut: "3", cls: "border-averna-cyan/50 text-averna-cyan hover:bg-averna-cyan/10" },
  { key: "easy", label: "Easy", shortcut: "4", cls: "border-averna-neon/50 text-averna-neon hover:bg-averna-neon/10" },
];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

function nextReviewLabel(due: number | undefined, fresh: boolean, now: number): string {
  if (fresh) return "New — ready to learn";
  if (due == null || due <= now) return "Due now";
  const days = Math.ceil((due - now) / DAY);
  if (days <= 1) return due - now < 12 * 3_600_000 ? "Next review later today" : "Next review tomorrow";
  if (days < 30) return `Next review in ${days} days`;
  const months = Math.round(days / 30);
  return `Next review in ${months <= 1 ? "a month" : `${months} months`}`;
}

function Example({ entry, word }: { entry: DictEntry; word: string }) {
  const ex = entry.senses[0]?.example;
  if (!ex) return null;
  const pieces = markHeadword(ex, [entry.headword, entry.lemma, word]);
  return (
    <p className="mt-4 text-base italic leading-relaxed text-gray-300">
      &ldquo;
      {pieces.map((p, i) =>
        p.hit ? (
          <strong key={i} className="font-semibold not-italic text-white">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
      &rdquo;
    </p>
  );
}

// ---------------------------------------------------------------------------
// Word list row
// ---------------------------------------------------------------------------

function WordRow({
  item,
  fresh,
  due,
  now,
  speech,
  onRemove,
}: {
  item: SavedWord;
  fresh: boolean;
  due: number | undefined;
  now: number;
  speech: boolean;
  onRemove: (word: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entry = item.entry;
  const headword = entry?.headword ?? item.word;
  const sense = entry?.senses[0];

  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const remove = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setError("");
    const res = await onRemove(item.word);
    if (!res.ok) {
      setBusy(false);
      setConfirm(false);
      setError(res.error ?? "Couldn't remove the word.");
    }
  };

  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-white">{headword}</span>
          {entry?.pos && <span className="text-xs italic text-gray-400">{entry.pos}</span>}
          {entry?.ipa && <span className="text-xs text-averna-cyan">{entry.ipa}</span>}
        </p>
        {sense && <p className="mt-0.5 text-sm leading-snug text-gray-300">{sense.definition}</p>}
        {sense?.translation && (
          <p className="text-sm font-medium text-averna-neon" lang={item.lang ?? undefined}>
            {sense.translation}
          </p>
        )}
        <p className={cn("mt-1 text-[11px] uppercase tracking-wider", fresh || due == null || due <= now ? "text-averna-cyan" : "text-gray-500")}>
          {nextReviewLabel(due, fresh, now)}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {speech && (
          <button
            type="button"
            onClick={() => speakEnglish(headword)}
            aria-label={`Listen: ${headword}`}
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-averna-cyan motion-reduce:transition-none", FOCUS_RING)}
          >
            <Volume2 className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label={confirm ? `Confirm: remove ${headword} from My words` : `Remove ${headword} from My words`}
          className={cn(
            "inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors motion-reduce:transition-none",
            FOCUS_RING,
            confirm ? "border border-red-400/50 bg-red-500/10 text-red-200" : "text-gray-500 hover:bg-white/10 hover:text-red-300"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          {confirm && !busy && <span>Remove?</span>}
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Review session
// ---------------------------------------------------------------------------

/** Back of a card: IPA + part of speech, definition, translation, other meanings. */
function CardBack({ item }: { item: SavedWord }) {
  const entry = item.entry;
  const [first, ...others] = entry?.senses ?? [];
  const lang = item.lang ?? undefined;
  return (
    <div className="mt-6 border-t border-white/10 pt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      {(entry?.pos || entry?.ipa) && (
        <p className="text-sm text-gray-400">
          {entry?.pos && <span className="italic">{entry.pos}</span>}
          {entry?.pos && entry?.ipa && " · "}
          {entry?.ipa && <span className="font-medium text-averna-cyan">{entry.ipa}</span>}
        </p>
      )}
      {first ? (
        <>
          <p className="mt-2 text-lg font-semibold text-averna-cyan">{first.definition}</p>
          {first.translation && (
            <div className="mt-3">
              {item.lang && (
                <p className="mb-0.5 text-xs uppercase tracking-widest text-averna-neon">{DICT_LANG_LABEL[item.lang].native}</p>
              )}
              <p className="text-base font-medium text-white" lang={lang}>
                {first.translation}
              </p>
            </div>
          )}
          {others.length > 0 && (
            <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-sm text-gray-400">
              {others.map((s, i) => (
                <li key={i}>
                  • {s.definition}
                  {s.translation && (
                    <span className="text-gray-200" lang={lang}>
                      {" "}
                      — {s.translation}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-400">The dictionary entry for this word isn&apos;t available right now.</p>
      )}
    </div>
  );
}

function Session({
  data,
  queue,
  setQueue,
  onEnd,
  speech,
}: {
  data: MyWordsState;
  queue: string[];
  setQueue: (fn: (q: string[]) => string[]) => void;
  onEnd: () => void;
  speech: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const flippedRef = useRef(false);
  flippedRef.current = flipped;
  const goodRef = useRef<HTMLButtonElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const byKey = useMemo(() => new Map(data.words.map((w: SavedWord) => [w.itemKey, w] as [string, SavedWord])), [data.words]);
  const currentKey = queue[0];
  const current: SavedWord | undefined = currentKey ? byKey.get(currentKey) : undefined;
  const prev = currentKey ? data.srs[currentKey] : undefined;

  const flip = useCallback(() => setFlipped(true), []);

  // A word that disappeared from the list (removed elsewhere) is skipped, never a dead end.
  useEffect(() => {
    if (currentKey && !byKey.has(currentKey)) setQueue((q: string[]) => q.slice(1));
  }, [currentKey, byKey, setQueue]);

  // Focus follows the session: "Show meaning" on a new card, "Good" once revealed, "Back" at the end.
  useEffect(() => {
    if (!currentKey) doneRef.current?.focus({ preventScroll: true });
    else if (flipped) goodRef.current?.focus({ preventScroll: true });
    else revealRef.current?.focus({ preventScroll: true });
  }, [flipped, currentKey]);

  const rate = useCallback(
    (rating: Rating) => {
      const key = queue[0];
      if (!key) return;
      data.rate(key, rating);
      stopSpeaking();
      setReviewed((n: number) => n + 1);
      setFlipped(false);
      setQueue((q: string[]) => {
        const [first, ...rest] = q;
        // "Again" comes back near the end of this session.
        return rating === "again" && first ? [...rest, first] : rest;
      });
    },
    [data, queue, setQueue]
  );

  // Keyboard: Space / Enter reveals, 1–4 rate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!flippedRef.current) {
        if ((e.key === " " || e.key === "Enter") && (!t || t === document.body)) {
          e.preventDefault();
          flip();
        }
        return;
      }
      const r = RATINGS.find((x) => x.shortcut === e.key);
      if (r) {
        e.preventDefault();
        rate(r.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, rate]);

  if (currentKey && !current) return null; // being skipped (see above)
  if (!current) {
    return (
      <div className="glass rounded-xl border border-averna-neon/40 px-6 py-14 text-center">
        <PartyPopper className="mx-auto mb-4 h-12 w-12 text-averna-neon" aria-hidden />
        <p className="text-xl font-bold text-white" role="status">
          All caught up! 🎉
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {reviewed > 0
            ? `You reviewed ${reviewed} word${reviewed === 1 ? "" : "s"}. They'll come back when it's time.`
            : "No saved words are due right now."}
        </p>
        <button
          ref={doneRef}
          type="button"
          onClick={onEnd}
          className={cn("glow-hover mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white", FOCUS_RING)}
        >
          <BookMarked className="h-4 w-4 text-averna-neon" aria-hidden />
          Back to my words
        </button>
      </div>
    );
  }

  const entry = current.entry;
  const headword = entry?.headword ?? current.word;
  const fresh = isFreshCard(prev);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-400" aria-live="polite">
          {queue.length} left in this session
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-averna-neon">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {reviewed} reviewed
          </span>
          <button
            type="button"
            onClick={onEnd}
            className={cn("rounded-md px-2 py-1 text-xs font-semibold text-gray-400 hover:text-white", FOCUS_RING)}
          >
            End session
          </button>
        </span>
      </div>

      <div
        className="glass rounded-xl border border-averna-purple/40 px-5 py-8 text-center sm:px-8"
        onClick={flipped ? undefined : flip}
      >
        <span
          className={cn(
            "inline-block text-[10px] uppercase tracking-widest",
            fresh ? "text-averna-pink" : "text-averna-cyan"
          )}
        >
          {fresh ? "new word" : "review"}
        </span>
        <div className="mt-3 flex items-center justify-center gap-2">
          <p className="break-words text-4xl font-bold text-white">{headword}</p>
          {speech && (
            <button
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                speakEnglish(headword);
              }}
              aria-label={`Listen: ${headword}`}
              className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-averna-cyan hover:bg-white/10", FOCUS_RING)}
            >
              <Volume2 className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        {entry && <Example entry={entry} word={current.word} />}

        {!flipped && (
          <button
            ref={revealRef}
            type="button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              flip();
            }}
            className={cn("glow-hover mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white", FOCUS_RING)}
          >
            Show meaning
          </button>
        )}
        {/* Always in the DOM so screen readers announce the answer when it appears. */}
        <div aria-live="polite">{flipped && <CardBack item={current} />}</div>
      </div>

      {flipped ? (
        <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember it?">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              ref={r.key === "good" ? goodRef : undefined}
              type="button"
              onClick={() => rate(r.key)}
              aria-keyshortcuts={r.shortcut}
              className={cn("flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border bg-white/5 py-2 transition-colors motion-reduce:transition-none", r.cls, FOCUS_RING)}
            >
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-[10px] opacity-70">{intervalHint(prev, r.key)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500">
          <Sparkles className="h-3.5 w-3.5 text-averna-purple" aria-hidden />
          Recall the meaning, then reveal it and grade yourself.
          <span className="hidden sm:inline"> Keys: Space to reveal, 1–4 to grade.</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

export function MyWordsDeck({ data }: { data: MyWordsState }) {
  const [queue, setQueueState] = useState<string[] | null>(null);
  const [speech, setSpeech] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inSession = useRef(false);

  // Back from a session: focus lands on the deck heading instead of getting lost.
  useEffect(() => {
    if (queue) {
      inSession.current = true;
    } else if (inSession.current) {
      inSession.current = false;
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [queue]);

  useEffect(() => {
    setSpeech(canSpeak());
    return () => stopSpeaking();
  }, []);
  // Relative "next review" labels stay fresh.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const setQueue = useCallback((fn: (q: string[]) => string[]) => {
    setQueueState((q: string[] | null) => (q ? fn(q) : q));
  }, []);

  const start = () => {
    const t = Date.now();
    const due = data.words
      .filter((w) => isDue(data.srs[w.itemKey], t))
      .sort((a, b) => (data.srs[a.itemKey]?.due ?? a.dueAt) - (data.srs[b.itemKey]?.due ?? b.dueAt))
      .slice(0, MAX_SESSION)
      .map((w) => w.itemKey);
    setQueueState(due);
  };

  const end = () => {
    stopSpeaking();
    setQueueState(null);
    setNow(Date.now());
  };

  if (queue) return <Session data={data} queue={queue} setQueue={setQueue} onEnd={end} speech={speech} />;

  if (data.status === "loading") {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading your words">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/5 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="error-surface flex items-start gap-3 rounded-xl p-4" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-red-100">{data.error || "Your words couldn't be loaded."}</p>
          <button
            type="button"
            onClick={data.reload}
            className={cn("mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-md text-sm font-semibold text-white hover:underline", FOCUS_RING)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data.canSave) {
    return (
      <div className="glass rounded-xl border border-white/10 px-6 py-12 text-center text-sm text-gray-400">
        My words is for student accounts — students save words from the dictionary while they read.
      </div>
    );
  }

  if (data.words.length === 0) {
    return (
      <div className="glass rounded-xl border border-averna-neon/25 px-6 py-12 text-center">
        <BookMarked className="mx-auto mb-3 h-10 w-10 text-averna-neon" aria-hidden />
        <p className="text-lg font-semibold text-white">No saved words yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
          While you read — a Reading practice passage, a test result or the Article of the Day — select a word, look it up
          and tap <span className="font-semibold text-gray-200">Add to my words</span>. It lands here for spaced review.
        </p>
        <Link
          href="/article"
          className={cn("glow-hover mt-5 inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white", FOCUS_RING)}
        >
          Read today&apos;s article
        </Link>
      </div>
    );
  }

  const due = data.dueCount;
  return (
    <section aria-labelledby="my-words-title">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-averna-neon/25 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 ref={titleRef} tabIndex={-1} id="my-words-title" className="flex items-center gap-2 text-lg font-semibold text-white outline-none">
            <BookMarked className="h-5 w-5 text-averna-neon" aria-hidden /> My words
          </h2>
          <p className="mt-0.5 text-sm text-gray-400">
            {data.words.length} saved · {due > 0 ? `${due} due now` : "nothing due right now"}
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={due === 0}
          className={cn(
            "glow-cta inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition hover:bg-averna-light disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
            FOCUS_RING
          )}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {due > 0 ? `Review ${due} due` : "All caught up"}
        </button>
      </div>

      <ul role="list" className="mt-4 space-y-2">
        {data.words.map((w) => {
          const state = data.srs[w.itemKey];
          return (
            <WordRow
              key={w.itemKey}
              item={w}
              fresh={isFreshCard(state)}
              due={state?.due ?? w.dueAt}
              now={now}
              speech={speech}
              onRemove={data.remove}
            />
          );
        })}
      </ul>
    </section>
  );
}

export default MyWordsDeck;
