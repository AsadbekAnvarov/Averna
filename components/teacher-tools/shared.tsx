"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export const panel = "glass rounded-2xl border border-averna-cyan/20 p-5 sm:p-6";
export const control = "w-full rounded-xl border border-white/20 bg-black/60 [color-scheme:dark] px-3 py-3 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan";
export const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan";
export function Status({ error, notice }: { error: string; notice: string }) { return <>{error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="rounded-xl border border-averna-cyan/30 bg-averna-cyan/10 p-4 text-sm text-gray-200">{notice}</p>}</>; }
export function useTool<T>(initial: T, url: string, auto = false) {
  const [view, setView] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [unavailable, setUnavailable] = useState(false);
  const [target, setTarget] = useState("GLOBAL");
  const flight = useRef(false), alive = useRef(true), controller = useRef<AbortController>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const request = useCallback(async (command?: Record<string, unknown>, silent = false) => {
    if (flight.current || !alive.current) return false; flight.current = true; setBusy(true); if (!silent) { setTarget(String(command?.action ?? "GLOBAL")); setError(""); setNotice(""); }
    controller.current = new AbortController();
    let timedOut = false; const timeout = setTimeout(() => { timedOut = true; controller.current?.abort(); }, 12000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.current.signal, ...(command ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) } : {}) });
      const result = await response.json(); if (!alive.current) return false;
      if (!response.ok) { if ([401, 403, 404].includes(response.status)) setUnavailable(true); throw new Error(result.error ?? "Could not refresh. Keep your input and retry."); }
      if (!result.view) throw new Error("Could not read the saved result. Keep your input and refresh."); setView(result.view); setUnavailable(false); if (!silent) setError(""); if (!silent) setNotice(command ? "Saved. No grades or XP were changed." : "Latest classroom state loaded."); return true;
    } catch (e) { if (alive.current && timedOut) setError("The connection timed out. Your input is kept in this tab. Refresh or retry; a timed-out write may already have been saved."); else if (alive.current && !(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Connection unavailable. Keep your input and retry."); return false; }
    finally { clearTimeout(timeout); flight.current = false; if (alive.current) setBusy(false); }
  }, [url]);
  useEffect(() => { if (!auto) return; const timer = setInterval(() => { if (document.visibilityState === "visible") void request(undefined, true); }, 8000); return () => clearInterval(timer); }, [auto, request]);
  return { view, busy, error, notice, unavailable, request, target };
}
export function useDirtyWarning(dirty: boolean) { useEffect(() => { if (!dirty) return; const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]); }
