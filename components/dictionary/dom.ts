/**
 * DOM helpers for the in-text dictionary (browser only; no React).
 */

import { sentenceAround } from "@/lib/dictionary-core";

/** A Range over [start, end) character offsets of `el`'s text content, or null. */
export function rangeFromOffsets(el: Element, start: number, end: number): Range | null {
  try {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let at = 0;
    let startSet = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.textContent?.length ?? 0;
      if (!startSet && start <= at + len) {
        range.setStart(node, Math.max(0, start - at));
        startSet = true;
      }
      if (startSet && end <= at + len) {
        range.setEnd(node, Math.max(0, end - at));
        return range.collapsed ? null : range;
      }
      at += len;
    }
    return null;
  } catch {
    return null;
  }
}

/** Live viewport rect of a range (null once it no longer covers anything on screen). */
export function rangeRect(range: Range): DOMRect | null {
  try {
    const rects = Array.from(range.getClientRects()).filter((b) => b.width > 0 && b.height > 0);
    if (!rects.length) return null;
    if (rects.length === 1) return rects[0];
    const r = range.getBoundingClientRect();
    return r.width > 0 || r.height > 0 ? r : rects[0];
  } catch {
    return null;
  }
}

/** `data-lookup-text` marks the text part of a block whose label (paragraph letter, speaker) sits beside it. */
const BLOCKS = "[data-lookup-text], p, li, dd, dt, blockquote, td, th, figcaption, h1, h2, h3, h4, h5, h6";

/** The sentence around a selection, read from its block (paragraph, list item …) inside `root`. */
export function contextOfRange(range: Range, root: HTMLElement): string {
  try {
    const node = range.startContainer;
    const start = node instanceof Element ? node : node.parentElement;
    let block = start?.closest(BLOCKS) as HTMLElement | null;
    if (!block || !root.contains(block)) block = root;
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(range.startContainer, range.startOffset);
    const from = pre.toString().length;
    return sentenceAround(block.textContent ?? "", from, from + range.toString().length);
  } catch {
    return "";
  }
}
