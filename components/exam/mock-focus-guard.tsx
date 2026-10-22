"use client";
import { useEffect, useRef, useState } from "react";
import { MockDialog } from "./mock-start-button";
import { MockFocusQueue } from "./mock-focus-client";

export function FullscreenOffer() {
  const [message, setMessage] = useState("");
  return <div className="mc-focus-intro my-5 rounded-lg border border-current/20 p-4 text-sm leading-relaxed"><strong>Stay in your Mock exam</strong><p className="my-3">During the exam, Averna navigation is restricted to Mock or confirmed exit. Leaving this tab is recorded with its duration for your teacher. The clock keeps running; a switch does not automatically fail your exam. Only tab visibility is recorded, not the contents of other tabs.</p><button type="button" className="min-h-[44px] rounded-lg border border-current/30 px-4" onClick={async () => { try { if (!document.documentElement.requestFullscreen) throw new Error(); await document.documentElement.requestFullscreen(); setMessage("Full screen enabled. You can leave full screen with Escape."); } catch { setMessage("Full screen is unavailable on this device. You can still start your exam normally."); } }}>Use full screen (optional)</button>{message && <p role="status">{message}</p>}</div>;
}

/** CDI only. Visibility, not blur: a permission dialog or focus on browser chrome is not counted. */
export function MockFocusGuard({ attemptId, section }: { attemptId: string; section: number }) {
  const index = useRef(section); index.current = section;
  const [warning, setWarning] = useState<number | null>(null);
  const [fullExit, setFullExit] = useState(false);
  useEffect(() => {
    const queue = new MockFocusQueue(attemptId);
    const resumed = document.visibilityState === "visible" ? queue.show() : null;
    if (resumed !== null) setWarning(resumed);
    queue.monitor(index.current); void queue.flush();
    window.dispatchEvent(new CustomEvent("averna:mock-active", { detail: attemptId }));
    // Make underlying Averna chrome and global shortcuts inaccessible while the sitting is open.
    const root = document.querySelector(".mock-cdi"); const restored: { el: HTMLElement; inert: boolean }[] = [];
    let node: Element | null = root;
    while (node?.parentElement && node.parentElement !== document.body) {
      for (const el of Array.from(node.parentElement.children)) if (el !== node && el instanceof HTMLElement) { restored.push({ el, inert: el.inert }); el.inert = true; }
      node = node.parentElement;
    }
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); } };
    const visibility = () => {
      if (document.visibilityState === "hidden") { queue.hide(index.current); queue.beacon(); }
      else { const duration = queue.show(); if (duration !== null) setWarning(duration); void queue.flush(); }
    };
    const unload = (e: BeforeUnloadEvent) => { queue.beacon(); e.preventDefault(); e.returnValue = ""; };
    let wasFull = !!document.fullscreenElement;
    const fullscreen = () => { const full = !!document.fullscreenElement; if (wasFull && !full) setFullExit(true); wasFull = full; };
    const retry = () => void queue.flush();
    document.addEventListener("visibilitychange", visibility); document.addEventListener("fullscreenchange", fullscreen);
    document.addEventListener("keydown", key, true); window.addEventListener("beforeunload", unload); window.addEventListener("online", retry);
    const timer = setInterval(retry, 15000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); document.removeEventListener("fullscreenchange", fullscreen); document.removeEventListener("keydown", key, true); window.removeEventListener("beforeunload", unload); window.removeEventListener("online", retry); restored.forEach(({ el, inert }) => { el.inert = inert; }); void queue.flush(); window.dispatchEvent(new Event("averna:mock-check")); };
  }, [attemptId]);
  return <>
    {(warning !== null || fullExit) && <MockDialog titleId="mc-focus-warning" descriptionId="mc-focus-description" onClose={() => { setWarning(null); setFullExit(false); }} role="alertdialog"><h2 id="mc-focus-warning" className="text-xl font-bold">{warning !== null ? "You left the exam tab" : "Full screen ended"}</h2><p id="mc-focus-description" className="mt-3 leading-relaxed">{warning !== null ? `This tab was hidden for ${Math.max(1, Math.ceil(warning / 1000))} seconds. The event is queued for your teacher’s focus log. ` : "Full screen is optional. "}Your exam clock has continued running. This does not automatically fail or end your attempt.</p><button className="mc-start mt-6" data-autofocus onClick={() => { setWarning(null); setFullExit(false); }}>Continue Mock</button></MockDialog>}
  </>;
}
