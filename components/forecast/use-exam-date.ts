"use client";

import { useCallback, useEffect, useState } from "react";

/** The device's IELTS exam date (same key the onboarding wizard and Today's session use). */
export const EXAM_DATE_KEY = "averna_exam_date";

/**
 * `[examDate, save, loaded]` — null until read after mount, so the server
 * render and the first client render match.
 */
export function useExamDate(): [string | null, (date: string) => void, boolean] {
  const [date, setDate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setDate(localStorage.getItem(EXAM_DATE_KEY) || null);
    } catch {
      /* storage blocked — no exam date */
    }
    setLoaded(true);
  }, []);

  const save = useCallback((next: string) => {
    setDate(next || null);
    try {
      if (next) localStorage.setItem(EXAM_DATE_KEY, next);
      else localStorage.removeItem(EXAM_DATE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return [date, save, loaded];
}
