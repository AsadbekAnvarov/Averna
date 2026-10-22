"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MockLeaveButton, MOCK_HUB_HREF, mockRunHref } from "./mock-start-button";

/** UI restriction within Averna, not a browser lock or a replacement for server authorization. */
export function MockNavigationGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const { data: session } = useSession();
  const [attempt, setAttempt] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const student = session?.user?.role === "STUDENT";
  const exempt = pathname.startsWith("/auth/") || pathname.startsWith("/api/");
  const run = attempt ? mockRunHref(attempt) : null;
  const blocked = student && !exempt && !!attempt && pathname !== run;
  useEffect(() => {
    if (!student || exempt) { setAttempt(null); setChecking(false); return; }
    let live = true, seq = 0;
    const check = async () => { const n = ++seq; setChecking(true); try { const r = await fetch("/api/mock/active", { cache: "no-store" }); if (!r.ok) throw new Error(); const x = await r.json(); if (live && n === seq) { setAttempt(typeof x.attemptId === "string" ? x.attemptId : null); setError(false); } } catch { if (live && n === seq) setError(true); } finally { if (live && n === seq) setChecking(false); } };
    const active = (e: Event) => { ++seq; setAttempt((e as CustomEvent<string>).detail); setChecking(false); };
    void check();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void check(); }, 15000);
    window.addEventListener("averna:mock-active", active); window.addEventListener("averna:mock-check", check); window.addEventListener("focus", check);
    return () => { live = false; clearInterval(timer); window.removeEventListener("averna:mock-active", active); window.removeEventListener("averna:mock-check", check); window.removeEventListener("focus", check); };
  }, [student, exempt, pathname]);
  useEffect(() => {
    if (container.current) container.current.inert = blocked;
    if (!blocked) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = document.querySelector<HTMLElement>("[data-mock-navigation]");
    const controls = () => Array.from(modal?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)") ?? []);
    controls()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !modal?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !modal?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
  }, [blocked]);
  // The real exam remains visible while polling. Navigation away is covered, not silently abandoned.
  return <><div ref={container} aria-hidden={blocked || undefined}>{children}</div>{blocked && <div data-mock-navigation role="dialog" aria-modal="true" aria-labelledby="mock-nav-title" className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#f9f8f7] p-6 text-[#2c2c2b]"><section className="w-full max-w-lg rounded-xl border border-[#e6e5e3] bg-white p-6"><h1 id="mock-nav-title" className="text-2xl font-bold">Your Mock is still running</h1><p className="mt-4 leading-relaxed">Other Averna pages are unavailable during this Mock. Return to your exam, or confirm that you want to leave. The exam clock does not pause.</p>{error && <p role="status" className="mt-4">Connection unavailable. Keep your exam open; your attempt has not been ended.</p>}<a href={run!} className="mt-6 flex min-h-[48px] items-center justify-center rounded-lg bg-[#1b1b1b] px-4 font-semibold text-white">Return to Mock</a><div className="mt-3 rounded-lg bg-[#202020] text-white"><MockLeaveButton attemptId={attempt!} redirectTo={MOCK_HUB_HREF} label="Leave Mock" /></div><p className="mt-4 text-sm text-[#65625e]">{checking ? "Checking your attempt…" : "Teacher-led sessions can only be cancelled by your teacher."}</p></section></div>}</>;
}
