"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ExamAnswers } from "@/lib/ielts/types";

/** useLayoutEffect in the browser (runs before paint); useEffect during SSR, where layout effects warn. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Answer + flag state for one exam attempt, autosaved to localStorage so a
 * refresh or a dropped connection never loses work. `onChange` lets the mock
 * exam mirror answers to the server (debounce on the caller side).
 */
export function useExamAnswers(opts: {
  storageKey: string;
  initial?: ExamAnswers;
  preferInitial?: boolean;
  onChange?: (answers: ExamAnswers) => void;
}) {
  const { storageKey, initial, onChange } = opts;
  const [answers, setAnswers] = useState<ExamAnswers>(initial ?? {});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Restore a previous session of the SAME attempt (server-provided answers win).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { answers?: ExamAnswers; flagged?: number[] };
        if (!opts.preferInitial && (!initial || Object.keys(initial).length === 0)) {
          if (saved.answers && typeof saved.answers === "object") {
            setAnswers(saved.answers);
            // Answers restored from this device never reached the server mirror
            // (mock autosave) — report them now instead of waiting for the next change.
            if (Object.keys(saved.answers).length > 0) onChangeRef.current?.(saved.answers);
          }
        }
        if (Array.isArray(saved.flagged)) setFlagged(new Set(saved.flagged.filter((n) => Number.isInteger(n))));
      }
    } catch {
      /* corrupted storage — start clean */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist (debounced) after hydration.
  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ answers, flagged: Array.from(flagged), savedAt: Date.now() })
        );
      } catch {
        /* storage full / private mode */
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [answers, flagged, hydrated, storageKey]);

  const setAnswer = useCallback((n: number, value: string | string[]) => {
    setAnswers((prev) => {
      const next = { ...prev };
      const empty = Array.isArray(value) ? value.length === 0 : value.trim() === "" && value.length === 0;
      if (empty) delete next[String(n)];
      else next[String(n)] = value;
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const toggleFlag = useCallback((n: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  const clearSaved = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { answers, setAnswer, flagged, toggleFlag, hydrated, clearSaved };
}

/**
 * Countdown to an absolute deadline (ms epoch). Using an absolute time means a
 * refresh can't reset the clock. `onExpire` fires exactly once.
 */
export function useDeadline(deadline: number | null | undefined, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useIsomorphicLayoutEffect(() => {
    if (!deadline) return;
    fired.current = false;
    // `now` may be stale (set at mount, or when the previous deadline stopped
    // ticking): sync it before paint so the first frame shows the real remaining time.
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  const remainingMs = deadline ? Math.max(0, deadline - now) : null;

  useEffect(() => {
    if (deadline && remainingMs === 0 && !fired.current) {
      fired.current = true;
      onExpireRef.current?.();
    }
  }, [deadline, remainingMs]);

  return { remainingMs, expired: remainingMs === 0 };
}

/** Warn before leaving the page while an attempt is in progress. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

/** Stable per-attempt id (crypto.randomUUID when available). */
export function newAttemptId(prefix = "a"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** mm:ss (or h:mm:ss) for the timer pill. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Scroll a question into view inside its pane and focus its first control. */
export function focusQuestion(n: number) {
  const el = document.getElementById(`q-${n}`);
  if (!el) return;
  const reduceMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  const control = el.querySelector<HTMLElement>("input, select, textarea, button[role='radio'], button[role='checkbox']");
  window.setTimeout(() => control?.focus({ preventScroll: true }), 250);
}
