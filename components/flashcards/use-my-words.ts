"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wordItemKey, type DictLang, type SavedWord } from "@/lib/dictionary-core";
import { fetchMyWords, getPreferredLang, removeMyWord } from "@/components/dictionary/client";
import { isDue, loadSrs, mergeSrs, saveSrs, schedule, type Rating, type SrsCardState, type SrsMap } from "@/lib/srs";

/**
 * The student's saved dictionary words ("My words") with their spaced-
 * repetition state. Scheduling is the normal SRS maths (lib/srs.ts): the
 * server ledger (ReviewItem `word:<key>`) is merged with this device's
 * localStorage map exactly like the other decks, and every review is mirrored
 * to POST /api/srs/review — so XP, streaks and cross-device sync just work.
 */

export type MyWordsStatus = "loading" | "ready" | "error";

export interface MyWordsState {
  status: MyWordsStatus;
  error: string;
  words: SavedWord[];
  /** Merged SRS state per itemKey. */
  srs: SrsMap;
  /** False for a viewer without a student profile. */
  canSave: boolean;
  lang: DictLang | null;
  dueCount: number;
  reload: () => void;
  /** Rate one review; returns the new state. */
  rate: (itemKey: string, rating: Rating) => SrsCardState;
  remove: (word: string) => Promise<{ ok: boolean; error?: string }>;
}

/** Never reviewed yet (a freshly saved word has a server row with no progress). */
export function isFreshCard(state: SrsCardState | undefined): boolean {
  return !state || (state.reps === 0 && state.lapses === 0 && state.interval === 0);
}

export function useMyWords(): MyWordsState {
  const [status, setStatus] = useState<MyWordsStatus>("loading");
  const [error, setError] = useState("");
  const [words, setWords] = useState<SavedWord[]>([]);
  const [srs, setSrs] = useState<SrsMap>({});
  const [canSave, setCanSave] = useState(true);
  const [lang, setLang] = useState<DictLang | null>(null);
  const [attempt, setAttempt] = useState(0);
  const srsRef = useRef<SrsMap>({});

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus((s: MyWordsStatus) => (s === "ready" ? s : "loading"));
    fetchMyWords(getPreferredLang(), ctrl.signal).then((res) => {
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        if (res.aborted) return;
        setError(res.error);
        setStatus("error");
        return;
      }
      const server: SrsMap = {};
      for (const w of res.data.words) {
        server[w.itemKey] = { ease: w.ease, interval: w.interval, due: w.dueAt, reps: w.reps, lapses: w.lapses };
      }
      const local = loadSrs();
      const merged = mergeSrs(local, server);
      if (res.data.words.length) saveSrs(merged);
      const mine: SrsMap = {};
      for (const w of res.data.words) mine[w.itemKey] = merged[w.itemKey];
      srsRef.current = mine;
      setSrs(mine);
      setWords(res.data.words);
      setCanSave(res.data.canSave);
      setLang(res.data.lang);
      setError("");
      setStatus("ready");
    });
    return () => ctrl.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n: number) => n + 1), []);

  const rate = useCallback((itemKey: string, rating: Rating): SrsCardState => {
    const next = schedule(srsRef.current[itemKey], rating);
    srsRef.current = { ...srsRef.current, [itemKey]: next };
    setSrs(srsRef.current);
    // Re-read the device map so progress made in the other decks meanwhile is never overwritten.
    const local = loadSrs();
    local[itemKey] = next;
    saveSrs(local);
    fetch("/api/srs/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemKey, rating, source: "vocab" }),
    }).catch(() => {});
    return next;
  }, []);

  const remove = useCallback(async (word: string) => {
    const res = await removeMyWord(word);
    if (!res.ok) return { ok: false, error: res.error };
    setWords((list: SavedWord[]) => list.filter((w) => w.word !== word));
    const key = wordItemKey(word);
    const rest: SrsMap = { ...srsRef.current };
    delete rest[key];
    srsRef.current = rest;
    setSrs(rest);
    const local = loadSrs();
    if (key in local) {
      delete local[key];
      saveSrs(local);
    }
    return { ok: true };
  }, []);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return words.reduce((n: number, w: SavedWord) => n + (isDue(srs[w.itemKey], now) ? 1 : 0), 0);
  }, [words, srs]);

  return { status, error, words, srs, canSave, lang, dueCount, reload, rate, remove };
}
