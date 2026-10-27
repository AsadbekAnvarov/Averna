import { CLASS_MAP, PREF_KEYS } from "@/lib/comfort/prefs";

/** Storage key → { value → <html> class }, from the same map as lib/comfort/prefs.ts. */
const KEY_CLASS_MAP = Object.fromEntries(
  (Object.keys(CLASS_MAP) as (keyof typeof CLASS_MAP)[]).map((name) => [PREF_KEYS[name], CLASS_MAP[name]])
);

/**
 * Inline <head> script: puts the saved text size, readable font, line spacing
 * and high contrast on <html> before the first paint, on every page (until now
 * a saved Large text size only came back once the dashboard's Customize panel
 * mounted). On a first visit with the system's "more contrast" setting on, the
 * contrast setting starts at "high" (and is saved, so it can be switched off).
 * Kept free of "use client" so the server layout can inline the string.
 */
export const COMFORT_SCRIPT =
  `try{var d=document.documentElement,s=localStorage,M=${JSON.stringify(KEY_CLASS_MAP)},C=${JSON.stringify(PREF_KEYS.contrast)},` +
  `g=function(k){try{return s.getItem(k)}catch(_){return null}},` +
  `h=g(C)===null&&!!window.matchMedia&&window.matchMedia("(prefers-contrast: more)").matches;` +
  `if(h){try{s.setItem(C,"high")}catch(_){}}` +
  `for(var k in M){var v=k===C&&h?"high":g(k);if(v!==null&&Object.prototype.hasOwnProperty.call(M[k],v))d.classList.add(M[k][v])}}catch(_){}`;
