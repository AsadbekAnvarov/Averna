"use client";

import { useCallback, useEffect, useState } from "react";
import { COMFORT_EVENT, readPrefs, savePrefs, type ComfortPrefs } from "@/lib/comfort/prefs";

/**
 * The device's comfort prefs, live: null on the server and until mounted (so
 * nothing that depends on them can cause a hydration mismatch), then updated
 * on every change in this tab (COMFORT_EVENT) or another one (storage event).
 */
export function useComfortPrefs(): { prefs: ComfortPrefs | null; update: (patch: Partial<ComfortPrefs>) => void } {
  const [prefs, setPrefs] = useState<ComfortPrefs | null>(null);

  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    sync();
    window.addEventListener(COMFORT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COMFORT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<ComfortPrefs>) => setPrefs(savePrefs(patch)), []);
  return { prefs, update };
}
