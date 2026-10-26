"use client";

import { useEffect, useRef, useState } from "react";
import { COMFORT_EVENT, applyPrefs, readPrefs, savePrefs } from "@/lib/comfort/prefs";

/** Band height in rem, so it follows the text size setting. */
const BAND_REM = 2.4;

/**
 * Reading ruler (Settings → Reading comfort, or Alt+R anywhere): a bright
 * horizontal band with the rest of the screen dimmed. It follows the cursor on
 * desktop and the finger on phones (and stays where the finger left), hides
 * when the cursor leaves the window. A fixed, aria-hidden, pointer-events-none
 * overlay, so it never blocks a click or a scroll and works over exam passages
 * and articles alike. Moves are rAF-throttled transforms; no transitions with
 * reduced motion. Mounted once in the app shell, which also keeps <html>'s
 * comfort classes in step when another tab changes them.
 */
export function ReadingRuler() {
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const track = useRef({ y: -1, visible: true, frame: 0, half: 19 });

  // Follow the saved setting (this tab and others).
  useEffect(() => {
    const sync = () => setOn(readPrefs().ruler === "on");
    const fromOtherTab = () => {
      applyPrefs(readPrefs());
      sync();
    };
    sync();
    window.addEventListener(COMFORT_EVENT, sync);
    window.addEventListener("storage", fromOtherTab);
    return () => {
      window.removeEventListener(COMFORT_EVENT, sync);
      window.removeEventListener("storage", fromOtherTab);
    };
  }, []);

  // Alt+R toggles it (e.code: on macOS Option+R types "®").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
      if (e.code !== "KeyR" && e.key?.toLowerCase() !== "r") return;
      e.preventDefault();
      const next = readPrefs().ruler === "on" ? "off" : "on";
      savePrefs({ ruler: next });
      setMessage(next === "on" ? "Reading ruler on" : "Reading ruler off");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!on) return;
    const t = track.current;
    const measure = () => {
      const fs = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      t.half = (fs * BAND_REM) / 2;
    };
    const paint = () => {
      t.frame = 0;
      const root = rootRef.current;
      const top = topRef.current;
      const band = bandRef.current;
      const bottom = bottomRef.current;
      if (!root || !top || !band || !bottom) return;
      // Before the first move (e.g. switched on with Alt+R) it waits at 40 % of the screen.
      const y = t.y < 0 ? window.innerHeight * 0.4 : t.y;
      top.style.transform = `translateY(${y - t.half}px) translateY(-100%)`;
      band.style.transform = `translateY(${y - t.half}px)`;
      bottom.style.transform = `translateY(${y + t.half}px)`;
      root.style.opacity = t.visible ? "1" : "0";
    };
    const schedule = () => {
      if (!t.frame) t.frame = requestAnimationFrame(paint);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !Number.isFinite(e.clientY)) return; // touch has its own listeners (pointermove stops while scrolling)
      t.y = e.clientY;
      t.visible = true;
      schedule();
    };
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches?.[0];
      if (!touch || !Number.isFinite(touch.clientY)) return;
      t.y = touch.clientY;
      t.visible = true;
      schedule();
    };
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      t.visible = false;
      schedule();
    };
    const onResize = () => {
      measure();
      schedule();
    };

    measure();
    t.visible = true;
    schedule();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("resize", onResize);
    window.addEventListener(COMFORT_EVENT, onResize); // the text size may have changed
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(COMFORT_EVENT, onResize);
      if (t.frame) cancelAnimationFrame(t.frame);
      t.frame = 0;
    };
  }, [on]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
      {on && (
        <div ref={rootRef} aria-hidden="true" data-reading-ruler="" className="reading-ruler" style={{ opacity: 0 }}>
          <div ref={topRef} className="reading-ruler__dim" />
          <div ref={bandRef} className="reading-ruler__band" />
          <div ref={bottomRef} className="reading-ruler__dim" />
        </div>
      )}
    </>
  );
}
