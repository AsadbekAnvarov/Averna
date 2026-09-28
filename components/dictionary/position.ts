/**
 * Where the dictionary popover goes (pure geometry, no DOM).
 *
 * The popover sits ABOVE or BELOW the looked-up word — never on top of it —
 * whichever side has room (the preferred side first), clamped horizontally
 * into the visible viewport. Its max height is the room on the chosen side,
 * so on a small phone it scrolls inside instead of covering the word.
 */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  maxHeight: number;
  side: "above" | "below";
}

/** Space kept between the word and the popover, and between the popover and the viewport edge. */
export const GAP = 8;
export const MARGIN = 8;
/** Below this much room the other side is tried. */
const MIN_ROOM = 140;

export function placePopover(
  anchor: Box,
  size: { width: number; height: number },
  view: Box,
  prefer: "above" | "below" = "below"
): Placement {
  const viewBottom = view.top + view.height;
  const anchorBottom = anchor.top + anchor.height;
  const roomAbove = Math.max(0, anchor.top - view.top - GAP - MARGIN);
  const roomBelow = Math.max(0, viewBottom - anchorBottom - GAP - MARGIN);

  const fits = (room: number) => room >= Math.min(size.height, MIN_ROOM) && room >= size.height * 0.6;
  let side: "above" | "below";
  if (prefer === "below") side = fits(roomBelow) || roomBelow >= roomAbove ? "below" : "above";
  else side = fits(roomAbove) || roomAbove >= roomBelow ? "above" : "below";
  // The preferred side must hold the whole popover when the other one does.
  if (side === prefer) {
    const room = side === "below" ? roomBelow : roomAbove;
    const other = side === "below" ? roomAbove : roomBelow;
    if (room < size.height && other >= size.height) side = side === "below" ? "above" : "below";
  }

  const room = side === "below" ? roomBelow : roomAbove;
  const maxHeight = Math.max(0, Math.floor(room));
  const height = Math.min(size.height, maxHeight);
  const top = side === "below" ? anchorBottom + GAP : anchor.top - GAP - height;

  const minLeft = view.left + MARGIN;
  const maxLeft = Math.max(minLeft, view.left + view.width - MARGIN - size.width);
  const centred = anchor.left + anchor.width / 2 - size.width / 2;
  const left = Math.min(maxLeft, Math.max(minLeft, centred));

  return { top: Math.round(top), left: Math.round(left), maxHeight, side };
}
