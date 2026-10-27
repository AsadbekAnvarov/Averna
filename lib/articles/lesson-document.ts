import { LESSON_NS, LESSON_SANDBOX } from "./lesson-bridge";

/**
 * Serving an interactive lesson file unchanged.
 *
 * The supplied files run their own engine (reading, games, quizzes, writing) and keep
 * progress in localStorage. They are served in a sandboxed, opaque-origin frame, where
 * the real localStorage is unavailable (that is what keeps the app's session and
 * storage out of reach). LESSON_SHIM, inserted first in <head>, provides an in-memory
 * localStorage synced with the host page (lib/articles/lesson-bridge.ts), and runs the
 * lesson's two scripts once the host has sent the saved values. The scripts' content
 * is untouched; only their `type` is changed so the parser doesn't run them early.
 */
export const DEFERRED_SCRIPT_TYPE = "text/x-averna-deferred";

/** Plain ES5, ASCII only (it precedes <meta charset>; the charset comes from the HTTP header). */
export const LESSON_SHIM = `(function () {
  "use strict";
  var NS = "${LESSON_NS}", DEFERRED = "${DEFERRED_SCRIPT_TYPE}";
  var has = Object.prototype.hasOwnProperty;
  var framed = window.parent !== window;
  var items = Object.create(null), haveState = !framed, parsed = false, ran = false;

  // Messages go to the app only: location.origin is the URL's origin even in an opaque-origin frame.
  function post(msg) {
    if (!framed) return;
    msg.ns = NS;
    try { window.parent.postMessage(msg, location.origin); } catch (e) {}
  }

  var storage = {
    getItem: function (k) { k = String(k); return has.call(items, k) ? items[k] : null; },
    setItem: function (k, v) { k = String(k); v = String(v); items[k] = v; post({ type: "set", key: k, value: v }); },
    removeItem: function (k) { k = String(k); delete items[k]; post({ type: "remove", key: k }); },
    clear: function () { items = Object.create(null); post({ type: "clear" }); },
    key: function (i) { var keys = Object.keys(items); i = Math.floor(Number(i)); return i >= 0 && i < keys.length ? keys[i] : null; }
  };
  Object.defineProperty(storage, "length", { get: function () { return Object.keys(items).length; } });
  // The opaque origin's own localStorage getter throws; it is replaced, never called.
  try { Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return storage; } }); } catch (e) {}

  function setTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  }

  // Runs the lesson's scripts in document order, once the saved values are in and the document is parsed.
  function run() {
    if (ran || !haveState || !parsed) return;
    ran = true;
    var list = document.querySelectorAll('script[type="' + DEFERRED + '"]');
    for (var i = 0; i < list.length; i++) {
      var s = document.createElement("script");
      s.text = list[i].textContent;
      list[i].replaceWith(s);
    }
    post({ type: "ready" });
  }

  if (framed) {
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (e.source !== window.parent || !d || typeof d !== "object" || d.ns !== NS) return;
      if (d.type === "state") {
        if (!ran && d.items && typeof d.items === "object") {
          for (var k in d.items) if (has.call(d.items, k) && typeof d.items[k] === "string") items[k] = d.items[k];
        }
        setTheme(d.theme);
        haveState = true;
        run();
      } else if (d.type === "theme") {
        setTheme(d.theme);
      }
    });
    post({ type: "hello" });
    // No answer from the host: start with an empty store rather than not at all.
    setTimeout(function () { haveState = true; run(); }, 1500);
  }
  if (document.readyState !== "loading") { parsed = true; run(); }
  else document.addEventListener("DOMContentLoaded", function () { parsed = true; run(); });
})();`;

const HEAD = "<head>";
const BODY = "<body>";
const SCRIPT = "<script>";

/**
 * The served document: LESSON_SHIM as the first child of <head>, and the two inline,
 * attribute-less scripts in <body> turned into `type="text/x-averna-deferred"` (content
 * byte-for-byte). Nothing else changes. Throws if the file doesn't have that structure.
 */
export function buildLessonDocument(html: string): string {
  const headAt = html.indexOf(HEAD);
  const bodyAt = html.indexOf(BODY);
  const tags = [...html.matchAll(/<script\b[^>]*>/gi)];
  if (headAt < 0 || bodyAt < headAt) throw new Error("buildLessonDocument: <head> / <body> not found");
  if (tags.length !== 2 || tags.some(tag => tag[0] !== SCRIPT || (tag.index ?? -1) < bodyAt)) {
    throw new Error("buildLessonDocument: expected exactly two inline <script> tags in <body>");
  }
  const [first, second] = tags.map(tag => tag.index as number);
  const headEnd = headAt + HEAD.length;
  const deferred = `<script type="${DEFERRED_SCRIPT_TYPE}">`;
  return (
    html.slice(0, headEnd) +
    `<script>${LESSON_SHIM}</script>` +
    html.slice(headEnd, first) +
    deferred +
    html.slice(first + SCRIPT.length, second) +
    deferred +
    html.slice(second + SCRIPT.length)
  );
}

/**
 * The document's own policy. `sandbox` keeps it opaque-origin even when opened directly;
 * connect-src 'none' blocks any network call; only the lesson's Google Fonts load.
 */
export const LESSON_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  `sandbox ${LESSON_SANDBOX}`,
].join("; ");

/**
 * The same policy for a saved offline copy (idea 7), which opens from a blob: URL with no HTTP
 * headers: as a <meta> tag, without the two directives a <meta> can't carry (frame-ancestors,
 * sandbox). The frame's own sandbox attribute (LESSON_SANDBOX) still keeps it opaque-origin.
 */
export const LESSON_META_CSP = LESSON_CSP.split("; ")
  .filter(directive => !/^(frame-ancestors|sandbox)\b/.test(directive))
  .join("; ");

/** A saved lesson document with LESSON_META_CSP as the very first element of <head>. */
export function offlineLessonDocument(html: string): string {
  const headAt = html.indexOf(HEAD);
  if (headAt < 0) throw new Error("offlineLessonDocument: <head> not found");
  const end = headAt + HEAD.length;
  return `${html.slice(0, end)}<meta http-equiv="Content-Security-Policy" content="${LESSON_META_CSP}">${html.slice(end)}`;
}

/** No X-Frame-Options: it would also block the app's own (opaque-origin) frame. */
export const LESSON_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, max-age=300",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": LESSON_CSP,
};
