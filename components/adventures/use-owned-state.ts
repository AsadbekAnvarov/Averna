"use client";
import { useEffect, useState } from "react";
import type { ZodType } from "zod";
/** Device-only drafts. A new owner never renders or overwrites the previous owner's state. */
export function useOwnedState<T>(owner: string, tool: string, initial: () => T, schema: ZodType<T>) {
  const key = `averna_adventures_v1:${owner}:${tool}`;
  const [store, setStore] = useState<{ key: string; value: T; loaded: boolean }>({ key, value: initial(), loaded: false });
  const [warning, setWarning] = useState("");
  useEffect(() => {
    let value = initial();
    let error = "";
    try {
      const raw = localStorage.getItem(key);
      if (raw && raw.length <= 80_000) { const parsed = schema.safeParse(JSON.parse(raw)); if (parsed.success) value = parsed.data; else error = "An old draft could not be restored. Your new session is separate."; }
      else if (raw) error = "The stored draft is too large to restore safely. This new session is separate.";
    } catch { error = "Device saving is unavailable. Keep this page open or copy your response before leaving."; }
    setStore({ key, value, loaded: true }); setWarning(error);
    // initial and schema are fixed per tool; only the owner/tool boundary reloads a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const value = store.key === key ? store.value : initial();
  const loaded = store.key === key && store.loaded;
  function update(next: T) {
    if (!loaded) return;
    const parsed = schema.safeParse(next);
    if (!parsed.success) { setWarning("This draft could not be saved. Shorten the response and try again."); return; }
    setStore({ key, value: parsed.data, loaded: true });
    try { localStorage.setItem(key, JSON.stringify(parsed.data)); setWarning(""); }
    catch { setWarning("Device storage is full or unavailable. Your response is still on screen; copy it before leaving."); }
  }
  return { value, update, loaded, warning };
}
