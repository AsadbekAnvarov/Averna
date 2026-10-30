import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARTICLE_LESSONS } from "@/lib/articles/catalog";
import { findInteractiveLesson, INTERACTIVE_LESSONS, interactiveReadingMinutes } from "@/lib/articles/interactive";
import { libraryCount, libraryItems } from "@/lib/articles/library";
import { LESSON_NS } from "@/lib/articles/lesson-bridge";
import { buildLessonDocument, DEFERRED_SCRIPT_TYPE, LESSON_SHIM } from "@/lib/articles/lesson-document";

const DIR = join(process.cwd(), "content", "articles", "intermediate");
const source = (file: string) => readFileSync(join(DIR, file), "utf8");
const SHIM_TAG = `<script>${LESSON_SHIM}</script>`;
const DEFERRED_TAG = `<script type="${DEFERRED_SCRIPT_TYPE}">`;

describe("interactive Intermediate lessons", () => {
  it("lists the 13 supplied lessons, all Intermediate, with slugs of their own", () => {
    expect(INTERACTIVE_LESSONS).toHaveLength(13);
    expect(INTERACTIVE_LESSONS.map(l => l.order)).toEqual([...Array(13)].map((_, i) => i + 1));
    expect(INTERACTIVE_LESSONS[0].slug).toBe("food-and-cooking");
    const slugs = INTERACTIVE_LESSONS.map(l => l.slug);
    expect(new Set(slugs).size).toBe(13);
    const structured = new Set(ARTICLE_LESSONS.map(a => a.slug));
    for (const lesson of INTERACTIVE_LESSONS) {
      expect(lesson.level).toBe("Intermediate");
      expect(lesson.levelLabel.startsWith("Intermediate")).toBe(true);
      expect(structured.has(lesson.slug)).toBe(false);
      expect(findInteractiveLesson(lesson.slug)).toBe(lesson);
      expect(lesson.description).not.toContain("{n}");
      expect(lesson.wordCount).toBeGreaterThan(0);
      expect(interactiveReadingMinutes(lesson)).toBeGreaterThan(0);
    }
    expect(findInteractiveLesson("what-are-they-like")).toBeUndefined();
  });

  it("adds them to the library after the unchanged structured lessons", () => {
    expect(libraryCount("Intermediate")).toBe(1 + 13);
    expect(libraryCount("Pre-intermediate")).toBe(10);
    expect(libraryCount()).toBe(24);
    expect(libraryCount("unknown")).toBe(0);
    const all = libraryItems();
    expect(all.slice(0, 11).map(i => i.lesson)).toEqual(ARTICLE_LESSONS);
    expect(all.slice(11).every(i => i.kind === "interactive")).toBe(true);
    expect(libraryItems("Intermediate")[0]).toMatchObject({ kind: "structured", lesson: { title: "What Are They Like?" } });
  });

  for (const lesson of INTERACTIVE_LESSONS) {
    it(`keeps ${lesson.sourceFile} byte-identical and serves it with only the shim added`, () => {
      const path = join(DIR, lesson.sourceFile);
      expect(existsSync(path)).toBe(true);
      expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(lesson.sourceSha256);

      const html = source(lesson.sourceFile);
      const served = buildLessonDocument(html);
      expect(served.slice(served.indexOf("<head>") + "<head>".length).startsWith(SHIM_TAG)).toBe(true);
      expect(served.split(DEFERRED_TAG)).toHaveLength(3);
      expect(served.replace(SHIM_TAG, "").replaceAll(` type="${DEFERRED_SCRIPT_TYPE}"`, "")).toBe(html);

      const doc = new JSDOM(served).window.document;
      expect(doc.head.firstElementChild?.textContent).toBe(LESSON_SHIM);
      expect(doc.querySelectorAll(`script[type="${DEFERRED_SCRIPT_TYPE}"]`)).toHaveLength(2);
      expect(doc.querySelectorAll("script")).toHaveLength(3);
    });

    it(`${lesson.sourceFile} makes no network, cookie or parent-frame calls`, () => {
      const html = source(lesson.sourceFile);
      for (const banned of ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "document.cookie", "window.parent", "window.top", "opener", "eval(", "new Function", "importScripts", "<iframe", "<script src"]) {
        expect(html.includes(banned), banned).toBe(false);
      }
      const hosts = new Set([...html.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)].map(m => new URL(m[0]).hostname));
      for (const host of hosts) expect(["fonts.googleapis.com", "fonts.gstatic.com", "t.me", "www.w3.org"]).toContain(host);
    });
  }

  it("refuses files that don't have the expected structure", () => {
    expect(() => buildLessonDocument("<html><body><p>no head</p></body></html>")).toThrow();
    expect(() => buildLessonDocument("<html><head></head><body><script>a</script></body></html>")).toThrow();
    expect(() => buildLessonDocument('<html><head></head><body><script>a</script><script src="x.js"></script></body></html>')).toThrow();
    expect(() => buildLessonDocument("<html><head><script>a</script></head><body><script>b</script></body></html>")).toThrow();
  });

  it("keeps the shim plain ASCII and free of </script", () => {
    expect(/^[\x09\x0a\x20-\x7e]*$/.test(LESSON_SHIM)).toBe(true);
    expect(LESSON_SHIM.toLowerCase()).not.toContain("</script");
  });
});

// A minimal lesson with the same shape as the supplied files: UNIT data, then the engine.
const FIXTURE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fixture</title>
</head>
<body>
<div id="app"></div>
<script>
window.UNIT = { id: "fixture" };
window.order = ["unit"];
</script>
<script>
window.order.push("engine:" + window.UNIT.id);
var before = localStorage.getItem("efvocab-v1-fixture");
localStorage.setItem("efvocab-v1-fixture", JSON.stringify({ seen: before }));
localStorage.removeItem("efvocab-mute");
document.getElementById("app").textContent = "built";
</script>
</body>
</html>
`;
const URL_ = "http://localhost:3000/api/articles/lesson/fixture";
const open: JSDOM[] = [];
afterEach(() => {
  while (open.length) open.pop()!.window.close();
});
function load(beforeParse?: (window: JSDOM["window"]) => void) {
  const dom = new JSDOM(buildLessonDocument(FIXTURE), { url: URL_, runScripts: "dangerously", beforeParse });
  open.push(dom);
  return dom;
}
const built = (dom: JSDOM) => vi.waitFor(() => expect(dom.window.document.getElementById("app")!.textContent).toBe("built"));

describe("lesson shim", () => {
  it("top level (opened directly): runs the scripts in order with an in-memory localStorage", async () => {
    let real: Storage | undefined;
    const dom = load(w => {
      real = w.localStorage;
    });
    await built(dom);
    const w = dom.window as unknown as Window & { order: string[] };
    expect(w.order).toEqual(["unit", "engine:fixture"]);
    expect(w.localStorage).not.toBe(real);
    expect(w.localStorage.getItem("efvocab-v1-fixture")).toBe(JSON.stringify({ seen: null }));
    expect(w.localStorage.length).toBe(1);
    expect(w.localStorage.key(0)).toBe("efvocab-v1-fixture");
    expect(real!.length).toBe(0);
    expect(dom.window.document.querySelectorAll(`script[type="${DEFERRED_SCRIPT_TYPE}"]`)).toHaveLength(0);
  });

  it("in a frame: says hello, waits for the saved state, then mirrors every write to the host", async () => {
    const postMessage = vi.fn();
    const parent = { postMessage };
    const dom = load(w => {
      Object.defineProperty(w, "parent", { configurable: true, get: () => parent });
    });
    const send = (data: unknown, source: unknown = parent) => {
      const event = new dom.window.MessageEvent("message", { data });
      Object.defineProperty(event, "source", { value: source });
      dom.window.dispatchEvent(event);
    };
    expect(postMessage).toHaveBeenCalledWith({ ns: LESSON_NS, type: "hello" }, "http://localhost:3000");
    await new Promise(r => setTimeout(r, 50));
    expect(dom.window.document.getElementById("app")!.textContent).toBe(""); // not started before the state

    send({ ns: LESSON_NS, type: "state", items: { "efvocab-v1-fixture": '"saved"' }, theme: "light" }, {}); // not the parent: ignored
    expect(dom.window.document.getElementById("app")!.textContent).toBe("");
    send({ ns: LESSON_NS, type: "state", items: { "efvocab-v1-fixture": '"saved"', bad: 42 }, theme: "dark" });
    await built(dom);
    const doc = dom.window.document;
    expect(doc.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(dom.window.localStorage.getItem("bad")).toBeNull();
    const calls = postMessage.mock.calls.map(([msg, origin]) => ({ ...msg, origin }));
    expect(calls).toEqual([
      { ns: LESSON_NS, type: "hello", origin: "http://localhost:3000" },
      { ns: LESSON_NS, type: "set", key: "efvocab-v1-fixture", value: JSON.stringify({ seen: '"saved"' }), origin: "http://localhost:3000" },
      { ns: LESSON_NS, type: "remove", key: "efvocab-mute", origin: "http://localhost:3000" },
      { ns: LESSON_NS, type: "ready", origin: "http://localhost:3000" },
    ]);

    send({ ns: LESSON_NS, type: "theme", theme: "light" });
    expect(doc.documentElement.getAttribute("data-theme")).toBe("light");
    send({ ns: LESSON_NS, type: "theme", theme: "dark" }, {});
    send({ ns: "other", type: "theme", theme: "dark" });
    send({ ns: LESSON_NS, type: "theme", theme: "purple" });
    expect(doc.documentElement.getAttribute("data-theme")).toBe("light");
    send({ ns: LESSON_NS, type: "state", items: {}, theme: "light" }); // a second state never re-runs the lesson
    expect((dom.window as unknown as { order: string[] }).order).toEqual(["unit", "engine:fixture"]);
  });
});
