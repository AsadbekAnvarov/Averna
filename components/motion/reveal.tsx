"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { motionDisabled } from "./gfx-tier";

/**
 * Scroll reveal — a calm fade + ~14px rise, once, when an element first enters
 * the viewport.
 *
 * Visible by default. The server renders everything fully visible; on
 * hydration (or mount) only elements that are BELOW THE FOLD are "armed"
 * (hidden) and then revealed by a shared IntersectionObserver. Anything already
 * on screen is never touched, so there is no invisible-until-hydrated flash.
 * Without JS, under prefers-reduced-motion, under html[data-gfx="lite"] and in
 * print nothing is ever hidden: the hiding CSS only applies on motion-OK,
 * full-tier screens (see "Motion system" in globals.css).
 *
 * The rise uses the individual `translate` property (not `transform`), so it
 * composes with a child's own hover transforms. All state is removed when the
 * animation ends — no lingering containing block or stacking context.
 */

const DEFAULT_Y = 14;
/** Must match the animation duration of [data-av-reveal="in"] in globals.css. */
const DURATION_MS = 520;
/** Siblings revealed together share at most this many stagger steps. */
const MAX_STAGGER_STEPS = 4;
const MAX_DELAY_MS = 400;

type GroupCtl = { stagger: number };
type Entry = { delay: number; y: number; group: GroupCtl | null; stop?: () => void };

const entries = new Map<HTMLElement, Entry>();
let queue: { el: HTMLElement; entry: Entry }[] = [];
let scheduled = false;
let observer: IntersectionObserver | null = null;

function byDocumentOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function getObserver(): IntersectionObserver {
  if (!observer) {
    // threshold 0 + a small bottom inset: fires as the top edge comes into
    // view, and works for elements taller than the viewport.
    observer = new IntersectionObserver(onIntersect, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
  }
  return observer;
}

function clearState(el: HTMLElement) {
  el.removeAttribute("data-av-reveal");
  el.style.removeProperty("--av-reveal-y");
  el.style.removeProperty("--av-reveal-delay");
}

/** Reveal finished (or cancelled): drop every trace of it. */
function settle(el: HTMLElement) {
  const entry = entries.get(el);
  entries.delete(el);
  entry?.stop?.();
  observer?.unobserve(el);
  clearState(el);
}

function play(el: HTMLElement, entry: Entry, delay: number) {
  if (delay > 0) el.style.setProperty("--av-reveal-delay", `${Math.round(delay)}ms`);
  el.setAttribute("data-av-reveal", "in");
  const onEnd = (e: Event) => {
    if (e.target === el) settle(el);
  };
  el.addEventListener("animationend", onEnd);
  el.addEventListener("animationcancel", onEnd);
  // Safety net if the animation never runs (tier switched to lite, CSS missing…).
  const timer = window.setTimeout(() => settle(el), delay + DURATION_MS + 300);
  entry.stop = () => {
    el.removeEventListener("animationend", onEnd);
    el.removeEventListener("animationcancel", onEnd);
    window.clearTimeout(timer);
  };
}

function onIntersect(records: IntersectionObserverEntry[]) {
  const hits = records
    .filter((r) => r.isIntersecting)
    .map((r) => r.target as HTMLElement)
    .filter((el) => entries.has(el))
    .sort(byDocumentOrder);
  if (!hits.length) return;
  const off = motionDisabled();
  const steps = new Map<GroupCtl, number>();
  for (const el of hits) {
    const entry = entries.get(el);
    observer?.unobserve(el);
    if (!entry || off) {
      settle(el);
      continue;
    }
    let delay = entry.delay;
    if (entry.group) {
      const i = steps.get(entry.group) ?? 0;
      steps.set(entry.group, i + 1);
      delay += Math.min(i, MAX_STAGGER_STEPS) * entry.group.stagger;
    }
    play(el, entry, delay);
  }
}

/** Decide which queued elements start hidden. Reads every rect first, then writes. */
function flush() {
  scheduled = false;
  const batch = queue;
  queue = [];
  // Forget armed elements React has since removed (e.g. group children swapped by a filter).
  entries.forEach((_, el) => {
    if (!el.isConnected) settle(el);
  });
  if (!batch.length || typeof IntersectionObserver === "undefined" || motionDisabled()) return;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!vh) return;

  const below = batch
    .filter(({ el }) => {
      if (!el.isConnected || entries.has(el)) return false;
      const r = el.getBoundingClientRect();
      // display:none / collapsed (0×0) or already on (or above) the screen → leave visible.
      return (r.width > 0 || r.height > 0) && r.top >= vh;
    })
    .sort((a, b) => byDocumentOrder(a.el, b.el));

  const io = getObserver();
  for (const { el, entry } of below) {
    // A hidden ancestor already reveals this subtree — don't double-animate.
    if (el.parentElement?.closest("[data-av-reveal]")) continue;
    entries.set(el, entry);
    if (entry.y !== DEFAULT_Y) el.style.setProperty("--av-reveal-y", `${entry.y}px`);
    el.setAttribute("data-av-reveal", "armed");
    io.observe(el);
  }
}

function arm(el: HTMLElement, entry: Entry) {
  queue.push({ el, entry });
  if (scheduled) return;
  scheduled = true;
  // Microtask: runs after React's commit, before the browser paints.
  Promise.resolve().then(flush);
}

function release(el: HTMLElement) {
  queue = queue.filter((q) => q.el !== el);
  if (entries.has(el)) settle(el);
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const clampDelay = (ms: number) => Math.max(0, Math.min(MAX_DELAY_MS, ms || 0));

type RevealTag = "div" | "section" | "article" | "aside" | "header" | "footer" | "nav" | "ul" | "ol" | "li";

export interface RevealProps {
  /** Element to render. Default "div". */
  as?: RevealTag;
  /** Extra delay before animating, in ms (max 400). Default 0. */
  delay?: number;
  /** Rise distance in px. Default 14. */
  y?: number;
  className?: string;
  id?: string;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: React.ReactNode;
}

/** Fades + rises its own element once when it scrolls into view. */
export function Reveal({ as = "div", delay = 0, y = DEFAULT_Y, className, children, ...attrs }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Decided once, at hydration / mount — later prop changes don't re-arm.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    arm(el, { delay: clampDelay(delay), y, group: null });
    return () => release(el);
  }, []);

  const Tag = as as "div";
  return (
    <Tag ref={ref} className={className} {...attrs}>
      {children}
    </Tag>
  );
}

export interface RevealGroupProps extends RevealProps {
  /** Delay between siblings that enter the viewport together, in ms. Default 60. */
  stagger?: number;
}

/**
 * Staggers its DIRECT children (e.g. the cards of a grid). The group element
 * itself never animates, so grid / list layout and semantics are untouched.
 * Children that enter the viewport together cascade; later rows start fresh.
 */
export function RevealGroup({ as = "div", stagger = 60, delay = 0, y = DEFAULT_Y, className, children, ...attrs }: RevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const group: GroupCtl = { stagger: Math.max(0, Math.min(120, stagger)) };
    const kids = Array.from(root.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    kids.forEach((el) => arm(el, { delay: clampDelay(delay), y, group }));
    return () => kids.forEach(release);
  }, []);

  const Tag = as as "div";
  return (
    <Tag ref={ref} className={className} {...attrs}>
      {children}
    </Tag>
  );
}
