"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Cloud,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseMistake, type MistakeCard } from "@/lib/mistakes/rules";
import { isDue, type Rating, type SrsCardState } from "@/lib/srs";

type Seed = { wrong: string; note: string; sourceTestId: string };
type Pending = Pick<
  MistakeCard,
  "id" | "wrong" | "right" | "note" | "sourceTestId"
>;
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The change was not saved. Please retry.");
  return data;
}

/** Cloud-owned content. Local additions are queued per account; legacy imports require explicit consent. */
export function MistakeBank({ userId, seed }: { userId: string; seed?: Seed }) {
  const key = `averna_mistakes_v2:${userId}`;
  const pendingKey = `${key}:pending`;
  const [items, setItems] = useState<MistakeCard[]>([]);
  const [ledger, setLedger] = useState<Record<string, SrsCardState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  const [legacy, setLegacy] = useState<Pending[]>([]);
  const [tab, setTab] = useState<"review" | "add" | "bank">(
    seed ? "add" : "review",
  );
  const [wrong, setWrong] = useState(seed?.wrong ?? "");
  const [right, setRight] = useState("");
  const [note, setNote] = useState(seed?.note ?? "");
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<{
    matched: boolean;
    correction: string;
  } | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const syncing = useRef(false);
  const alive = useRef(true);

  const storePending = useCallback(
    (next: Pending[]) => {
      // Write before changing UI: an unavailable storage must not claim an offline save.
      localStorage.setItem(pendingKey, JSON.stringify(next));
      pendingRef.current = next;
      setPending(next);
    },
    [pendingKey],
  );
  const refresh = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      for (const card of [...pendingRef.current]) {
        await api("/api/mistakes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card),
        });
        if (!alive.current) return;
        storePending(pendingRef.current.filter((p) => p.id !== card.id));
      }
      const [bank, srs] = await Promise.all([
        api("/api/mistakes"),
        api("/api/srs/review"),
      ]);
      if (!alive.current) return;
      setItems(bank.items);
      setLedger(srs.items);
      try {
        localStorage.setItem(key, JSON.stringify(bank.items));
      } catch {
        /* cloud content remains safe */
      }
      setError("");
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not connect. Retry when online.",
        );
    } finally {
      syncing.current = false;
      if (alive.current) setLoading(false);
    }
  }, [key, storePending]);

  useEffect(() => {
    alive.current = true;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(cached))
        setItems(cached.filter((c) => parseMistake(c)));
      const queued = JSON.parse(localStorage.getItem(pendingKey) || "[]");
      if (Array.isArray(queued)) {
        pendingRef.current = queued.filter((c) => parseMistake(c));
        setPending(pendingRef.current);
      }
      const old = JSON.parse(
        localStorage.getItem("averna_mistakes_v1") || "[]",
      );
      if (Array.isArray(old))
        setLegacy(
          old
            .map((c) => parseMistake({ ...c, id: `legacy-${userId}-${c.id}` }))
            .filter((c): c is Pending => c !== null),
        );
    } catch {
      /* malformed local cache never replaces cloud data */
    }
    void refresh();
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    return () => {
      alive.current = false;
      window.removeEventListener("online", reconnect);
    };
  }, [key, pendingKey, userId, refresh]);

  const due = items.filter(
    (item) => isDue(ledger[item.id]) && !reviewed.includes(item.id),
  );
  const current = due[0];
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    void run(async () => {
      const card = parseMistake({
        id: crypto.randomUUID(),
        wrong,
        right,
        note,
        sourceTestId: seed?.sourceTestId ?? null,
      });
      if (!card)
        throw new Error(
          "Write the original phrase and a different correction (up to 2,000 characters each).",
        );
      storePending([...pendingRef.current, card]);
      setWrong("");
      setRight("");
      setNote("");
      setTab("bank");
      await refresh();
    });
  const importLegacy = () =>
    void run(async () => {
      if (!navigator.onLine)
        throw new Error("Reconnect before importing browser-only cards.");
      for (const card of legacy)
        await api("/api/mistakes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card),
        });
      localStorage.removeItem("averna_mistakes_v1");
      setLegacy([]);
      await refresh();
    });
  const check = () =>
    current &&
    void run(async () => {
      const data = await api("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "practice", id: current.id, answer }),
      });
      setVerdict(data);
    });
  const rate = (rating: Rating) =>
    current &&
    void run(async () => {
      await api("/api/srs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemKey: current.id,
          source: "mistake",
          rating,
        }),
      });
      setReviewed((list) => [...list, current.id]);
      setVerdict(null);
      setAnswer("");
      await refresh();
    });

  return (
    <section
      className="correction-studio rounded-2xl border border-averna-cyan/25 bg-white/5 p-4 sm:p-6"
      aria-labelledby="mistake-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="flex items-center gap-2 text-sm text-study-ink">
            <BookMarked className="h-4 w-4" /> Learn from your own words
          </p>
          <h2
            id="mistake-heading"
            className="mt-2 text-2xl font-semibold text-white"
          >
            Your correction studio
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Notice it. Rewrite it. Bring it back when it matters.
          </p>
        </div>
        <p
          className="flex items-center gap-2 text-sm text-gray-300"
          role="status"
        >
          <Cloud className="h-4 w-4" />{" "}
          {loading
            ? "Connecting…"
            : pending.length
              ? `${pending.length} waiting to sync`
              : error
                ? "Connection needs attention"
                : "Saved to your account"}
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Retry sync
          </Button>
        </div>
      )}
      {legacy.length > 0 && (
        <div className="mb-5 rounded-xl border border-white/20 p-4 text-sm text-gray-300">
          <p>
            {legacy.length} older cards exist in this browser. They may belong
            to someone else who used this device.
          </p>
          <Button
            onClick={importLegacy}
            disabled={busy || loading}
            variant="outline"
            className="mt-3 min-h-11 whitespace-normal h-auto"
          >
            These are mine — import into my account
          </Button>
        </div>
      )}
      <div
        className="mb-6 flex flex-wrap gap-2"
        aria-label="Correction studio sections"
      >
        {(
          [
            ["review", `Practice · ${due.length}`],
            ["add", "Add correction"],
            ["bank", `My bank · ${items.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-lg px-4 text-sm border focus-visible:outline focus-visible:outline-2 focus-visible:outline-averna-cyan ${tab === value ? "border-averna-cyan/50 bg-averna-cyan/10 text-study-ink" : "border-white/15 text-gray-300"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "add" ? (
        <div className="space-y-4">
          {seed && (
            <p className="text-sm text-gray-300">
              From your Writing feedback. Write the corrected version yourself;
              the feedback tip is not automatically treated as an answer.
            </p>
          )}
          <div>
            <label
              htmlFor="mistake-wrong"
              className="block mb-2 text-sm text-gray-300"
            >
              Original phrase
            </label>
            <Textarea
              id="mistake-wrong"
              value={wrong}
              onChange={(e) => setWrong(e.target.value)}
              maxLength={2000}
              placeholder="I have went to London."
            />
          </div>
          <div>
            <label
              htmlFor="mistake-right"
              className="block mb-2 text-sm text-gray-300"
            >
              Your corrected version
            </label>
            <Textarea
              id="mistake-right"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              maxLength={2000}
              placeholder="I have been to London."
            />
          </div>
          <div>
            <label
              htmlFor="mistake-note"
              className="block mb-2 text-sm text-gray-300"
            >
              Rule or feedback tip (optional)
            </label>
            <Textarea
              id="mistake-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </div>
          <Button
            onClick={add}
            disabled={busy || loading || !wrong.trim() || !right.trim()}
            className="min-h-11 w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Save correction
          </Button>
        </div>
      ) : tab === "bank" ? (
        <div className="space-y-3">
          {pending.map((item) => (
            <p
              key={item.id}
              className="rounded-xl border border-amber-400/25 p-4 text-sm text-gray-300 break-words"
            >
              {item.wrong} → {item.right}
              <span className="block mt-2 text-amber-200">
                Saved on this device · waiting to sync
              </span>
            </p>
          ))}
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-white/15 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words">
                  <p className="text-sm text-gray-400">Before</p>
                  <p className="mt-1 text-white">{item.wrong}</p>
                  <p className="mt-3 text-sm text-study-ink">After</p>
                  <p className="mt-1 text-white">{item.right}</p>
                  {item.note && (
                    <p className="mt-3 text-sm text-gray-300">{item.note}</p>
                  )}
                  <p className="mt-3 text-sm text-gray-400">
                    {item.practiceCount} matching rewrite
                    {item.practiceCount === 1 ? "" : "s"}
                    {item.sourceTestId && (
                      <>
                        {" "}
                        ·{" "}
                        <Link
                          className="text-study-ink underline"
                          href={`/learning/writing/result/${encodeURIComponent(item.sourceTestId)}`}
                        >
                          Original feedback
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <button
                  aria-label="Delete correction"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `/api/mistakes?id=${encodeURIComponent(item.id)}`,
                        { method: "DELETE" },
                      );
                      await refresh();
                    })
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-gray-300 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-averna-cyan"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
          {!items.length && !pending.length && (
            <p className="py-6 text-gray-300">
              Your bank is empty. Add a correction or bring one here from your
              Writing result.
            </p>
          )}
        </div>
      ) : loading ? (
        <p role="status" className="flex items-center gap-2 py-8 text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your corrections…
        </p>
      ) : current ? (
        <div>
          <p className="mb-3 text-sm text-gray-400">
            Rewrite without looking at the answer
          </p>
          <p className="rounded-xl border border-white/15 p-4 text-lg text-white break-words">
            {current.wrong}
          </p>
          <label
            htmlFor="mistake-answer"
            className="block mt-5 mb-2 text-sm text-gray-300"
          >
            Your rewrite
          </label>
          <Input
            className="min-h-11"
            id="mistake-answer"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setVerdict(null);
            }}
            maxLength={2000}
            autoComplete="off"
            placeholder="Write the corrected phrase"
          />
          <Button
            disabled={busy || !answer.trim()}
            onClick={check}
            className="min-h-11 mt-4"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Check my rewrite
          </Button>
          {verdict && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-averna-cyan/30 bg-averna-cyan/5 p-4"
            >
              <p className="font-medium text-white">
                {verdict.matched
                  ? "You reproduced your saved correction."
                  : "Not the same as your saved correction yet."}
              </p>
              <p className="mt-2 text-gray-300 break-words">
                {verdict.correction}
              </p>
              {current.note && (
                <p className="mt-2 text-sm text-gray-300">{current.note}</p>
              )}
              <p className="mt-3 text-sm text-gray-400">
                This checks recall of your own correction, not an IELTS score.
                Other valid rewrites may exist.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {(["again", "hard", "good", "easy"] as Rating[]).map(
                  (rating) => (
                    <Button
                      key={rating}
                      variant="outline"
                      disabled={busy}
                      onClick={() => rate(rating)}
                      className="min-h-11 capitalize"
                    >
                      {rating}
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6">
          <h3 className="text-lg font-medium text-white">
            {reviewed.length
              ? "A little better than before."
              : "Ready for your next correction."}
          </h3>
          <p className="mt-2 text-gray-300">
            {reviewed.length
              ? `You worked through ${reviewed.length} correction${reviewed.length === 1 ? "" : "s"}. Your next reviews are scheduled.`
              : items.length
                ? "Nothing is due right now. Come back when your reviews are ready."
                : "Start with a phrase you want to improve. Your first correction becomes your first practice."}
          </p>
          <Link
            href="/learning/writing"
            className="inline-flex min-h-11 items-center gap-2 mt-4 text-study-ink"
          >
            Apply it in your next essay <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
