#!/usr/bin/env node
/**
 * CDI materials → Averna content formats (phase 1: files only, nothing wired in).
 *
 *   node scripts/cdi/import.mjs "D:\Cdi tests"
 *
 * Reads (never writes) the source folder and produces:
 *   lib/ielts/content/cdi/reading/cdi-reading-NN.json     ExamReadingTest (exam-v2)
 *   lib/ielts/content/cdi/listening/cdi-listening-NN.json ExamListeningTest + real `audio`
 *   lib/ielts/content/cdi/writing.json                    { task1: WritingPrompt[], task2: WritingPrompt[] }
 *   lib/ielts/content/cdi/report.json                     per-file status, reasons, warnings, counts
 *   lib/ielts/content/cdi/index.ts                        server-only static imports of exactly the files above
 *   public/cdi/images/…                                   only the images the output references
 *
 * Each source HTML is a self-contained exam app. Only the data declarations
 * are evaluated (node:vm, empty context, timeout); question-paper markup is
 * parsed with jsdom (scripts never run). A file that can't be converted
 * faithfully is SKIPPED with a reason — a test is never emitted with a
 * doubtful answer key. Every emitted test is checked with the app's own
 * validators (lib/ielts/validate.ts, bundled on the fly with esbuild).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { answerList, listeningForValidation } from "./answers.mjs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: node scripts/cdi/import.mjs "<path to CDI tests folder>"');
  process.exit(1);
}
const OUT = path.join(ROOT, "lib", "ielts", "content", "cdi");
const OUT_IMG = path.join(ROOT, "public", "cdi", "images");
const IMG_URL = "/cdi/images/";
/** Listening: max gap answers per test that may be missing from the transcript (see main). Mirrored in tests/cdi-content.test.ts. */
const MAX_TRANSCRIPT_MISSES = 3;

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

class Skip extends Error {}
const skip = (msg) => {
  throw new Skip(msg);
};

const pad2 = (n) => String(n).padStart(2, "0");
const NUM_WORDS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT"];

/** Source of the initializer of `const|let|var NAME = …` (bracket matched; strings, template literals and comments skipped). */
function declSource(src, name) {
  const re = new RegExp(`(?:^|[\\s;])(?:const|let|var)\\s+${name}\\s*=\\s*`, "m");
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  const open = src[start];
  let depth = 0;
  let str = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") str = c;
    else if (c === "/" && src[i + 1] === "/") i = src.indexOf("\n", i) < 0 ? src.length : src.indexOf("\n", i);
    else if (c === "/" && src[i + 1] === "*") i = src.indexOf("*/", i + 2) + 1 || src.length;
    else if ("{[(".includes(c)) depth++;
    else if ("}])".includes(c)) {
      depth--;
      if (depth === 0 && "{[(".includes(open)) return src.slice(start, i + 1);
    } else if (c === ";" && depth === 0) return src.slice(start, i);
  }
  return null;
}

/** Evaluate only the named data declarations, each in an empty sandbox. */
function evalDecls(src, names) {
  const out = {};
  for (const n of names) {
    const s = declSource(src, n);
    if (s == null) continue;
    try {
      out[n] = vm.runInContext(`(${s})`, vm.createContext({}), { timeout: 3000 });
    } catch (e) {
      out[n] = undefined;
      out[`${n}__error`] = String(e?.message ?? e);
    }
  }
  return out;
}

const dom = new JSDOM("<!doctype html><body></body>");
const { document: DOC } = dom.window;

/** HTML fragment → element (parsed inert: <template> content never runs scripts or loads images). */
function frag(html) {
  const t = DOC.createElement("template");
  t.innerHTML = String(html ?? "");
  const div = DOC.createElement("div");
  div.appendChild(t.content);
  div.querySelectorAll("script, style, noscript, iframe, object, embed").forEach((e) => e.remove());
  return div;
}

const clean = (s) =>
  String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

/** HTML → plain text (entities decoded, tags dropped, whitespace collapsed to single spaces). */
const text = (html) => clean(frag(html).textContent).replace(/\s+/g, " ");

/** Instruction lines: split on <br>, <p> and newlines, then strip tags. */
function htmlLines(html) {
  const s = String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n");
  return frag(s)
    .textContent.split("\n")
    .map((l) => clean(l).replace(/\s+/g, " "))
    .filter(Boolean);
}

/** "NO MORE THAN TWO WORDS AND/OR A NUMBER" → { wordLimit: 2, allowNumber: true }. */
function parseWordRule(textIn) {
  const t = String(textIn).toUpperCase().replace(/\s+/g, " ");
  const num = /AND\/OR A NUMBER|AND\/OR NUMBERS|OR A NUMBER|AND A NUMBER/.test(t);
  const m = /(ONE|TWO|THREE|FOUR|FIVE)\s+WORDS?/.exec(t);
  if (m) return { wordLimit: NUM_WORDS.indexOf(m[1]), allowNumber: num || undefined };
  if (/\b(ONE|A) NUMBER\b/.test(t)) return { wordLimit: 1, allowNumber: true };
  return {};
}

const RULE_LINE = /\b(WORDS?|NUMBERS?)\b.*\b(for each answer|from the (passage|text))|^(Choose|Write)\s+(NO MORE|ONE|TWO|THREE|ONLY)/i;

/** Split CDI instruction lines into the instruction text and the bold answer rule. */
function splitInstr(lines) {
  const rule = lines.filter((l) => RULE_LINE.test(l));
  const rest = lines.filter((l) => !RULE_LINE.test(l));
  return {
    instructions: (rest.length ? rest : lines).join(" "),
    answerRule: rest.length && rule.length ? rule.join(" ") : undefined,
  };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"];
const stripLetter = (label) => clean(String(label ?? "")).replace(/^([A-Za-z]|[ivxlcm]+)[.)]?\s+/, "");

const BINARY = { TRUE: "TRUE", FALSE: "FALSE", YES: "YES", NO: "NO", "NOT GIVEN": "NOT GIVEN", T: "TRUE", F: "FALSE", Y: "YES", N: "NO", NG: "NOT GIVEN" };
const binary = (a) => BINARY[String(Array.isArray(a) ? a[0] : a ?? "").trim().toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ")] ?? "";

function addCount(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

// ---------------------------------------------------------------------------
// Validators (the app's own, bundled from TypeScript with esbuild)
// ---------------------------------------------------------------------------

async function loadValidators() {
  try {
    const esbuild = require("esbuild");
    const outfile = path.join(os.tmpdir(), `averna-cdi-validate-${process.pid}.mjs`);
    await esbuild.build({
      entryPoints: [path.join(ROOT, "lib", "ielts", "validate.ts")],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile,
      logLevel: "silent",
    });
    const mod = await import(pathToFileURL(outfile).href);
    fs.rmSync(outfile, { force: true });
    return mod;
  } catch (e) {
    console.warn("! validators unavailable (esbuild):", e?.message ?? e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const usedImages = new Map(); // relative path under images/ → public URL

/** "images/listening3-map.webp" (relative to the source HTML) → "/cdi/images/listening3-map.webp" (copied later). */
function imageUrl(src, warnings) {
  const rel = String(src ?? "").replace(/^(\.\.\/)+|^\.\//, "").replace(/^\/+/, "");
  const m = /^images\/(.+)$/.exec(rel);
  if (!m) skip(`image outside images/: ${src}`);
  const file = path.join(SRC, "images", ...m[1].split("/"));
  if (!fs.existsSync(file)) skip(`image not found: ${src}`);
  if (/[^A-Za-z0-9._\/-]/.test(m[1])) warnings.push(`image name with unusual characters: ${m[1]}`);
  const url = IMG_URL + m[1];
  usedImages.set(m[1], url);
  return url;
}

// ---------------------------------------------------------------------------
// READING
// ---------------------------------------------------------------------------

function readingParagraphs(content) {
  const chunks = String(content ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|<\/p>\s*(?=<p)/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const out = [];
  // Some passages put the paragraph letter on its own line ("<strong>A</strong>\n\nText…"):
  // a label-only chunk labels the paragraph that follows it.
  let carry = null;
  for (const c of chunks) {
    const m = /^(?:<p[^>]*>\s*)?<(strong|b)>\s*([A-Z])\s*<\/\1>\s*/.exec(c);
    const body = text(m ? c.slice(m[0].length) : c);
    if (!body) {
      if (m) carry = m[2];
      continue;
    }
    const label = m ? m[2] : carry;
    carry = null;
    out.push(label ? { label, text: body } : { text: body });
  }
  return out;
}

/** Placeholders in CDI templates → [[n]] (only numbers that belong to the group). */
function toPlaceholders(s, ids) {
  const want = new Set(ids);
  return String(s)
    .replace(/__\((\d+)\)__|__(\d+)__/g, (all, a, b) => (want.has(Number(a ?? b)) ? `[[${Number(a ?? b)}]]` : all))
    .replace(/\b(\d+)\s*(?:\.{3,}|…+|_{3,})/g, (all, a) => (want.has(Number(a)) ? `[[${Number(a)}]]` : all));
}

/** Notes line: the first gap marker in the question text becomes [[n]] (as the CDI renderer does). */
function gapLine(qText, n) {
  const t = text(qText);
  const GAP = /(__\(\d+\)__|__\d+__|\d+\s*\.{3,}|\d+\s*…+|_{3,}|\.{3,}|…{2,})/;
  if (GAP.test(t)) return t.replace(GAP, `[[${n}]]`).replace(/\s+/g, " ").trim();
  return `${t} [[${n}]]`.trim();
}

/** HTML block (notes / summary / flow-chart markup) → exam-v2 template lines. */
function htmlTemplate(html, ids) {
  const root = frag(toPlaceholders(String(html).replace(/<br\s*\/?>/gi, "\n"), ids));
  return linearize([...root.childNodes]).lines.join("\n");
}

const BLOCK = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION", "TABLE", "TR", "TBODY", "THEAD", "BLOCKQUOTE", "LABEL"]);

/**
 * Walk DOM nodes and emit template lines: headings ("# …", a block whose whole
 * text is bold), bullets ("- …" for <li>), table rows ("| a | b |") and plain
 * lines. Inputs / drop zones carrying a question number become [[n]].
 */
function linearize(nodes, opts = {}) {
  const lines = [];
  const titles = [];
  let buf = "";
  let prefix = "";
  const flush = () => {
    const t = buf.replace(/\s+/g, " ").trim();
    if (t) lines.push(prefix + t);
    buf = "";
    prefix = "";
  };
  const inline = (node) => {
    let s = "";
    const walk = (n) => {
      if (n.nodeType === 3) s += n.textContent;
      else if (n.nodeType === 1) {
        const el = n;
        const q = qnum(el);
        if (q != null) {
          s += ` [[${q}]] `;
          return;
        }
        if (skipEl(el)) return;
        if (el.tagName === "BR") s += " ";
        el.childNodes.forEach(walk);
        if (BLOCK.has(el.tagName)) s += " ";
      }
    };
    node.childNodes.forEach(walk);
    return s.replace(/\s+/g, " ").trim();
  };
  const qnum = (el) => {
    if (el.tagName === "INPUT" && (el.getAttribute("type") ?? "text") === "text" && el.dataset.question) return Number(el.dataset.question);
    if (el.dataset?.drop && /drop-zone|dz/.test(el.className)) return Number(el.dataset.drop);
    return null;
  };
  const skipEl = (el) =>
    ["SCRIPT", "STYLE", "IMG", "SVG", "BUTTON", "SELECT", "OPTION", "NOSCRIPT"].includes(el.tagName.toUpperCase()) ||
    el.classList.contains("q-num-badge") ||
    el.classList.contains("dd-helptext") ||
    el.classList.contains("dd-help-row") ||
    el.classList.contains("fc-arrow") ||
    el.classList.contains("dd-optcol") ||
    el.classList.contains("dd-options") ||
    el.classList.contains("drag-chip") ||
    el.getAttribute("aria-hidden") === "true" ||
    (opts.skip && opts.skip(el));
  const walk = (n) => {
    if (n.nodeType === 3) {
      const parts = n.textContent.split("\n");
      parts.forEach((p, i) => {
        if (i > 0) flush();
        buf += p;
      });
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n;
    const q = qnum(el);
    if (q != null) {
      buf += ` [[${q}]] `;
      return;
    }
    if (skipEl(el)) return;
    const tag = el.tagName.toUpperCase();
    if (tag === "BR") return flush();
    if (/qbox-title|fc-title/.test(el.className) && !el.querySelector("input, .drop-zone")) {
      flush();
      titles.push(clean(el.textContent).replace(/\s+/g, " "));
      return;
    }
    if (tag === "TABLE") {
      flush();
      el.querySelectorAll("tr").forEach((tr) => {
        const cells = [...tr.children].filter((c) => c.tagName === "TD" || c.tagName === "TH").map((c) => inline(c).replace(/\|/g, "/"));
        if (cells.some(Boolean)) lines.push(`| ${cells.map((c) => c || " ").join(" | ")} |`);
      });
      lines.push("");
      return;
    }
    if (BLOCK.has(tag)) {
      flush();
      const own = clean(el.textContent);
      const bolds = [...el.children].filter((c) => /^(STRONG|B|H\d)$/.test(c.tagName));
      const isHeading =
        /^H\d$/.test(tag) ||
        (own && !el.querySelector("input, .drop-zone, li, div, p") && bolds.length === 1 && clean(bolds[0].textContent) === own);
      if (isHeading && tag !== "LI") {
        buf = own;
        prefix = "# ";
        flush();
        return;
      }
      if (tag === "LI") prefix = "- ";
      el.childNodes.forEach(walk);
      flush();
      return;
    }
    el.childNodes.forEach(walk);
  };
  nodes.forEach(walk);
  flush();
  // tidy: no blank line at the end, no double blanks
  const tidy = [];
  for (const l of lines) {
    if (l === "" && (tidy.length === 0 || tidy[tidy.length - 1] === "")) continue;
    tidy.push(l);
  }
  while (tidy.length && tidy[tidy.length - 1] === "") tidy.pop();
  return { lines: tidy, titles };
}

function qOptions(q) {
  const opts = q?.options ?? [];
  // A leading letter is a key only when every string option carries the next one
  // ("A …", "B …", "C …"); otherwise it is just the article "A" ("A contrast with…")
  // and the source renderer letters the options by position.
  const prefix = opts.map((o) => (typeof o === "string" ? (/^([A-Z]|[ivx]+)[.)]?\s+/.exec(o) ?? [])[1] : undefined));
  const lettered = opts.every((o, i) => typeof o !== "string" || prefix[i] === LETTERS[i] || prefix[i] === ROMAN[i]);
  // Object options ({ value: "B", label: "A translator may…" }) repeat their own key in
  // the label only sometimes; strip it only when every label starts with its value.
  const objKey = (o, i) => String(o.value ?? LETTERS[i]);
  const objLabel = (o) => String(o.label ?? o.text ?? "");
  const ownKey = (o, i) => new RegExp(`^${objKey(o, i).replace(/[^A-Za-z0-9]/g, "")}[.)]?\\s+`).test(clean(objLabel(o)));
  const objLettered = opts.every((o, i) => typeof o === "string" || o.headingText || ownKey(o, i));
  return opts.map((o, i) =>
    typeof o === "string"
      ? lettered
        ? { key: prefix[i], text: stripLetter(o) }
        : { key: LETTERS[i], text: clean(o).replace(/\s+/g, " ") }
      : { key: objKey(o, i), text: clean(o.headingText ?? (objLettered ? stripLetter(objLabel(o)) : objLabel(o))).replace(/\s+/g, " ") }
  );
}

function convertReading(file, html, stats) {
  const warnings = [];
  const d = evalDecls(html, ["testData", "LAYOUT"]);
  const td = d.testData;
  if (!td?.parts) skip(`testData not readable${d.testData__error ? `: ${d.testData__error}` : ""}`);
  if (!d.LAYOUT) skip("no LAYOUT (question-paper layout) declaration");
  if (td.parts.length !== 3) skip(`${td.parts.length} passages (expected 3)`);
  const num = Number(/(\d+)/.exec(file)[1]);
  const parts = [];
  const topics = [];
  for (const p of td.parts) {
    const byId = new Map(p.questions.map((q) => [Number(q.id), q]));
    const secs = d.LAYOUT[p.id] ?? d.LAYOUT[String(p.id)];
    if (!Array.isArray(secs) || !secs.length) skip(`passage ${p.id}: no layout sections`);
    const used = new Set();
    const need = (id) => {
      const q = byId.get(Number(id));
      if (!q) skip(`Q${id}: in the layout but missing from testData`);
      used.add(Number(id));
      return q;
    };
    const expl = (q) => {
      const e = text(q.explanation ?? "");
      if (e) return e;
      const quote = text(q.passageQuote ?? "");
      return quote ? `The passage says: “${quote}”` : undefined;
    };
    const answersOf = (q, opts) => {
      const extra = Array.isArray(q.acceptable) ? q.acceptable : q.acceptable ? [q.acceptable] : [];
      return answerList([...(Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]), ...extra], opts);
    };
    const letterAnswer = (q, keys, options) => {
      const a = answerList(q.correctAnswer, { split: false });
      if (a.length !== 1) skip(`Q${q.id}: expected one letter, got ${JSON.stringify(q.correctAnswer)}`);
      let k = a[0];
      if (!keys.includes(k)) {
        const lower = keys.find((x) => x.toLowerCase() === k.toLowerCase());
        const byText = options?.find((o) => o.text.toLowerCase() === k.toLowerCase());
        k = lower ?? byText?.key ?? skip(`Q${q.id}: answer "${a[0]}" is not one of ${keys.join(",")}`);
      }
      return [k];
    };
    const groups = [];
    for (const sec of secs) {
      const kindKey = sec.kind + (sec.variant ? `:${sec.variant}` : "");
      const lines = (sec.instr ?? []).flatMap(htmlLines);
      const ids = (sec.q ?? []).filter((x) => typeof x === "number");
      let g;
      switch (sec.kind) {
        case "triple": {
          let kind = sec.variant === "YNG" ? "ynng" : sec.variant === "TFNG" ? "tfng" : skip(`unknown triple variant ${sec.variant}`);
          // Layout says TFNG, but the question data is YES/NO/NOT GIVEN throughout: every
          // key is YES/NO/NOT GIVEN *and* the paper itself says so (the instructions
          // mention YES/NO, or every question is typed YES_NO_NOT_GIVEN). A group that
          // mixes TRUE/FALSE with YES/NO, or whose paper only ever says TRUE/FALSE, is
          // still skipped below.
          let ynSwitched = false;
          if (kind === "tfng" && ids.length) {
            const qs = ids.map((id) => byId.get(Number(id))).filter(Boolean);
            const keys = qs.map((q) => binary(q.correctAnswer));
            const allYn = qs.length === ids.length && keys.every((a) => ["YES", "NO", "NOT GIVEN"].includes(a)) && keys.some((a) => a !== "NOT GIVEN");
            const paperSaysYn = /\bYES\b/.test(lines.join(" ")) || qs.every((q) => q.type === "YES_NO_NOT_GIVEN");
            if (allYn && paperSaysYn) {
              kind = "ynng";
              ynSwitched = true;
              warnings.push(`Q${ids[0]}–${ids[ids.length - 1]}: layout says TRUE/FALSE/NOT GIVEN but the questions and key are YES/NO/NOT GIVEN — emitted as YES/NO/NOT GIVEN`);
            }
          }
          const allowed = kind === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"];
          const ownInstr = ynSwitched && !/\bYES\b/.test(lines.join(" ")) ? "" : lines.join(" ");
          g = {
            kind,
            instructions:
              ownInstr ||
              (kind === "tfng"
                ? `Do the following statements agree with the information given in Reading Passage ${p.id}?`
                : `Do the following statements agree with the claims of the writer in Reading Passage ${p.id}?`),
            questions: ids.map((id) => {
              const q = need(id);
              const a = binary(q.correctAnswer);
              if (!allowed.includes(a)) skip(`Q${id}: answer "${q.correctAnswer}" is not valid for a ${kind.toUpperCase()} group`);
              return { n: id, text: text(q.text), answer: [a], explanation: expl(q) };
            }),
          };
          break;
        }
        case "mcq": {
          g = {
            kind: "mcq",
            instructions: lines.join(" ") || "Choose the correct letter, A, B, C or D.",
            questions: ids.map((id) => {
              const q = need(id);
              const options = qOptions(q);
              if (options.length < 3) skip(`Q${id}: multiple choice with ${options.length} options`);
              return { n: id, text: text(q.text), options, answer: letterAnswer(q, options.map((o) => o.key), options), explanation: expl(q) };
            }),
          };
          break;
        }
        case "letters":
        case "lettergrid":
        case "headingdrag": {
          const qs = ids.map(need);
          let options = [];
          if (sec.kind === "headingdrag") {
            const h = p.passage?.headings;
            if (h && typeof h === "object") options = (sec.order ?? Object.keys(h)).filter((k) => h[k]).map((k) => ({ key: k, text: clean(text(h[k])) }));
            else options = qOptions(qs[0]);
          } else if (sec.box?.items?.length) {
            options = sec.box.items.map(([k, t]) => ({ key: String(k), text: text(t) }));
          } else if (qs[0]?.options?.length) {
            options = qOptions(qs[0]);
          } else if (!sec.box && (sec.letters ?? []).every((k) => /^[A-Z]$/.test(k))) {
            options = sec.letters.map((k) => ({ key: k, text: `Paragraph ${k}` }));
          } else {
            const lists = ["endings", "people", "researchers", "years", "headings", "words", "summaryPhrases"].map((k) => p.passage?.[k]).filter(Boolean);
            for (const l of lists) {
              const entries = Array.isArray(l) ? l.map((x, i) => (Array.isArray(x) ? x : [x.value ?? x.key ?? LETTERS[i], x.label ?? x.text ?? x])) : Object.entries(l);
              const opts = entries.map(([k, t]) => ({ key: String(k), text: stripLetter(text(t)) }));
              if ((sec.letters ?? []).every((k) => opts.some((o) => o.key === k))) {
                options = opts.filter((o) => !sec.letters || sec.letters.includes(o.key));
                break;
              }
            }
          }
          if (!options.length || options.some((o) => !o.key || !o.text)) skip(`Q${ids[0]}: matching list not found`);
          if (sec.letters?.length && !sec.letters.every((k) => options.some((o) => o.key === k))) {
            skip(`Q${ids[0]}: letters ${sec.letters.join("")} don't match the option list`);
          }
          const keys = options.map((o) => o.key);
          const questions = qs.map((q) => ({ n: Number(q.id), text: text(q.text), answer: letterAnswer(q, keys, options), explanation: expl(q) }));
          const repeats = new Set(questions.map((q) => q.answer[0])).size !== questions.length;
          const nb = /more than once/i.test(lines.join(" "));
          if (repeats && !nb) warnings.push(`Q${ids[0]}–${ids[ids.length - 1]}: answers repeat; allowReuse set although the paper has no "NB"`);
          if (sec.example) warnings.push(`Q${ids[0]}: layout has an example (${JSON.stringify(sec.example).slice(0, 80)}) — kept in the instructions`);
          const exampleText = sec.example ? ` Example: ${text(typeof sec.example === "string" ? sec.example : JSON.stringify(sec.example))}` : "";
          g = {
            kind: "matching",
            instructions: (lines.join(" ") || "Choose the correct letter for each statement.") + exampleText,
            title: clean(sec.boxTitle ?? sec.box?.title ?? (sec.kind === "headingdrag" ? "List of Headings" : "")) || undefined,
            options,
            allowReuse: repeats || nb || undefined,
            questions,
          };
          break;
        }
        case "choosetwo": {
          for (const pr of sec.pairs ?? []) {
            const qs = pr.ids.map(need);
            // Options come from the first question (what the source renderer shows); some
            // layouts carry them only on the pair ([["A", "…"], …]).
            const options = qs[0]?.options?.length
              ? qOptions(qs[0])
              : pr.options?.length
                ? pr.options.every((o) => Array.isArray(o))
                  ? pr.options.map(([k, t]) => ({ key: String(k), text: text(t) }))
                  : qOptions({ options: pr.options })
                : [];
            const keys = options.map((o) => o.key);
            const set = answerList(
              qs.flatMap((q) => (Array.isArray(q.groupCorrect) ? q.groupCorrect : Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer])),
              { split: false }
            )
              .map((k) => k.toUpperCase())
              .sort();
            if (set.length !== qs.length || !set.every((k) => keys.includes(k))) skip(`Q${pr.ids.join("+")}: choose-${qs.length} key ${JSON.stringify(set)} doesn't fit`);
            const n = NUM_WORDS[qs.length] ?? String(qs.length);
            groups.push({
              kind: "mcq-multi",
              instructions: lines.join(" ") || `Choose ${n} letters, ${keys[0]}–${keys[keys.length - 1]}.`,
              title: text(pr.prompt ?? qs[0].text),
              options,
              questions: qs.map((q) => ({ n: Number(q.id), answer: set, explanation: qs.map(expl).filter(Boolean).join(" ") || undefined })),
            });
            addCount(stats.layout, kindKey);
          }
          continue;
        }
        case "notes": {
          const tpl = [];
          for (const grp of sec.groups ?? [{ q: sec.q }]) {
            if (grp.sub) tpl.push(`# ${text(grp.sub)}`);
            for (const item of grp.q ?? []) {
              if (typeof item === "string") tpl.push(`- ${text(item)}`);
              else tpl.push(`- ${gapLine(need(item).text, Number(item))}`);
            }
          }
          const allIds = (sec.groups ?? [{ q: sec.q }]).flatMap((x) => x.q ?? []).filter((x) => typeof x === "number");
          ids.splice(0, ids.length, ...allIds);
          g = gapGroup(lines, sec.title, tpl.join("\n"), allIds.map(need), expl, answersOf, warnings);
          break;
        }
        case "summaryinput": {
          // Some layouts list no `q`: the numbers are the __(n)__ gaps of the paragraph.
          if (!ids.length) ids.push(...placeholderIds(sec.para));
          const qs = ids.map(need);
          const raw = sec.para ?? qs[0]?.text ?? "";
          const tpl = toPlaceholders(raw, ids)
            .split("\n")
            .map((l) => {
              const t = text(l);
              if (!t) return "";
              if (/^##\s+/.test(l.trim())) return `# ${t.replace(/^##\s+/, "")}`;
              if (/^[-\u2022]\s+/.test(l.trim())) return `- ${t.replace(/^[-\u2022]\s+/, "")}`;
              return t;
            })
            .filter(Boolean)
            .join("\n");
          if (sec.wordbox) {
            const options = sec.wordbox.map(([k, t]) => ({ key: String(k), text: text(t) }));
            g = {
              kind: "gap-box",
              ...splitInstr(lines),
              title: sec.title ? text(sec.title) : undefined,
              options,
              template: tpl,
              questions: qs.map((q) => ({ n: Number(q.id), answer: letterAnswer(q, options.map((o) => o.key), options), explanation: expl(q) })),
            };
          } else g = gapGroup(lines, sec.title, tpl, qs, expl, answersOf, warnings);
          break;
        }
        case "summarydropdown":
        case "summarydrag": {
          const qs = ids.length ? ids.map(need) : sec.segments.filter((s) => typeof s === "object").map((s) => need(s.q));
          ids.splice(0, ids.length, ...qs.map((q) => Number(q.id)));
          const options = (sec.box?.items ?? []).map(([k, t]) => ({ key: String(k), text: text(t) }));
          if (!options.length) skip(`Q${ids[0]}: word box missing`);
          const tpl = sec.segments.map((s) => (typeof s === "string" ? s : `[[${s.q}]]`)).join("");
          g = {
            kind: "gap-box",
            instructions: lines.join(" ") || "Complete the summary using the list of words below.",
            title: sec.title ? text(sec.title) : sec.box?.title ? text(sec.box.title) : undefined,
            options,
            template: text(tpl),
            questions: qs.map((q) => ({ n: Number(q.id), answer: letterAnswer(q, options.map((o) => o.key), options), explanation: expl(q) })),
          };
          break;
        }
        case "gapbox":
        case "worddrag": {
          if (!ids.length) ids.push(...placeholderIds(p.passage?.[sec.htmlKey]));
          const qs = ids.map(need);
          const src = p.passage?.[sec.htmlKey];
          if (!src) skip(`Q${ids[0]}: ${sec.htmlKey} markup missing`);
          const { lines: tl, titles } = linearize([...frag(toPlaceholders(String(src).replace(/<br\s*\/?>/gi, "\n"), ids)).childNodes]);
          let tpl = tl;
          let title;
          if (titles.length) title = titles[0];
          else if (tpl[0]?.startsWith("# ")) {
            title = tpl[0].slice(2);
            tpl = tpl.slice(1);
          }
          if (sec.box?.items?.length) {
            const options = sec.box.items.map(([k, t]) => ({ key: String(k), text: text(t) }));
            g = {
              kind: "gap-box",
              instructions: lines.join(" ") || "Complete the summary using the list of words below.",
              title,
              options,
              template: tpl.join("\n"),
              questions: qs.map((q) => ({ n: Number(q.id), answer: letterAnswer(q, options.map((o) => o.key), options), explanation: expl(q) })),
            };
          } else g = gapGroup(lines, title, tpl.join("\n"), qs, expl, answersOf, warnings);
          break;
        }
        default:
          skip(`unsupported layout section "${sec.kind}"`);
      }
      addCount(stats.layout, kindKey);
      groups.push(g);
    }
    const missing = p.questions.map((q) => Number(q.id)).filter((id) => !used.has(id));
    if (missing.length) skip(`passage ${p.id}: questions ${missing.join(",")} are not in the layout`);
    for (const q of p.questions) addCount(stats.qtypes, q.type);
    const paragraphs = readingParagraphs(p.passage?.content);
    if (!paragraphs.length) skip(`passage ${p.id}: empty passage`);
    const intro = text(p.passage?.intro ?? p.passage?.subtitle ?? "");
    const title = text(p.passage?.title) || `Reading Passage ${p.id}`;
    topics.push(title);
    parts.push({
      id: `passage-${p.id}`,
      title,
      ...(intro && intro.length <= 400 ? { subtitle: intro } : {}),
      paragraphs,
      groups,
    });
  }
  // Global numbering 1..40 in document order: groups must already be in order.
  const order = parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => q.n)));
  if (order.some((n, i) => i > 0 && n <= order[i - 1])) {
    // The CDI layout sometimes lists a later section first; sort groups by first number within each part.
    for (const p of parts) p.groups.sort((a, b) => a.questions[0].n - b.questions[0].n);
    warnings.push("question groups re-ordered by question number");
  }
  const test = {
    format: "exam-v2",
    skill: "READING",
    id: `cdi-reading-${pad2(num)}`,
    title: `CDI Reading Test ${pad2(num)}`,
    description: `A full Academic Reading test from the CDI practice materials: ${topics.join("; ")}.`,
    difficulty: "Medium",
    timeLimit: 60,
    topics,
    source: "cdi",
    parts,
  };
  return { test, warnings };
}

// Same rule as lib/ielts/grading.ts countLimitedWords (numbers are free when allowed).
const NUMERIC_TOKEN = /^[£$€]?\d[\d,.:/]*(%|st|nd|rd|th|am|pm)?$/i;
const limitedWords = (a, allowNumber) =>
  a
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !(allowNumber && NUMERIC_TOKEN.test(t))).length;

/**
 * Drop accepted spellings that break the group's word limit ("a story" under
 * ONE WORD ONLY). The app's grader marks an over-limit answer wrong anyway,
 * so they could never be accepted; the in-limit spellings stay.
 */
function fitLimit(n, answers, rule, warnings) {
  if (rule.wordLimit == null) return answers;
  const longest = (a) => Math.max(limitedWords(a.replace(/\([^)]*\)/g, " "), rule.allowNumber), limitedWords(a.replace(/[()]/g, ""), rule.allowNumber));
  const ok = answers.filter((a) => longest(a) <= rule.wordLimit);
  const dropped = answers.filter((a) => !ok.includes(a));
  if (!ok.length) skip(`Q${n}: every accepted answer (${answers.join(" / ")}) exceeds the ${rule.wordLimit}-word limit`);
  if (dropped.length) warnings.push(`Q${n}: dropped over-limit spellings ${dropped.map((x) => `"${x}"`).join(", ")}`);
  return ok;
}

function gapGroup(lines, title, template, qs, expl, answersOf, warnings) {
  const rule = parseWordRule(lines.join(" "));
  const g = {
    kind: "gap",
    ...splitInstr(lines),
    ...(rule.wordLimit != null ? { wordLimit: rule.wordLimit } : {}),
    ...(rule.allowNumber ? { allowNumber: true } : {}),
    title: title ? text(title) : undefined,
    template,
    questions: qs.map((q) => {
      const n = Number(q.id ?? q.n);
      return { n, answer: fitLimit(n, answersOf(q), rule, warnings), explanation: expl(q) };
    }),
  };
  return g;
}

/** Question numbers referenced by CDI placeholders (__(18)__ / __18__) in a template. */
const placeholderIds = (s) => [...String(s ?? "").matchAll(/__\((\d+)\)__|__(\d+)__/g)].map((m) => Number(m[1] ?? m[2]));

// ---------------------------------------------------------------------------
// LISTENING
// ---------------------------------------------------------------------------

function flattenSections(root) {
  const out = [];
  const walk = (el) => {
    for (const c of [...el.children]) {
      if (c.classList.contains("q-section-title")) out.push(c);
      else if (c.querySelector(".q-section-title")) walk(c);
      else out.push(c);
    }
  };
  walk(root);
  return out;
}

/** "A  too informal" boxes (<strong>A</strong> text) → { A: "too informal" }. */
function letterList(nodes) {
  const map = {};
  for (const root of nodes) {
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const first = el.firstElementChild;
      if (!first || !/^(STRONG|B)$/.test(first.tagName)) continue;
      const k = clean(first.textContent);
      if (!/^[A-Z]$/.test(k)) continue;
      if (el.querySelector("input, select, .drop-zone")) continue;
      const rest = clean(el.textContent).slice(clean(first.textContent).length).replace(/^[\s.)\-–—:]+/, "").replace(/\s+/g, " ");
      if (rest && !map[k]) map[k] = rest;
    }
  }
  return map;
}

function convertListening(file, html, stats) {
  const warnings = [];
  const d = evalDecls(html, ["partContent", "correctAnswers", "answerExplanations", "questionTimestamps", "audioScripts", "partConfig"]);
  if (!d.partContent || !d.correctAnswers) skip(`question paper or answer key not readable${d.partContent__error ? `: ${d.partContent__error}` : ""}`);
  const num = Number(/(\d+)/.exec(file)[1]);
  const audioSrc = /<audio[^>]*\ssrc="([^"]+)"/.exec(html)?.[1];
  const audioFile = audioSrc ? path.basename(audioSrc) : null;
  if (!audioFile || !/^listening-\d+\.mp3$/.test(audioFile)) skip(`audio source not recognised: ${audioSrc}`);
  if (audioFile !== `listening-${num}.mp3`) warnings.push(`audio file ${audioFile} for test ${num}`);
  const audioPath = path.join(SRC, "audio", audioFile);
  if (!fs.existsSync(audioPath)) warnings.push(`audio file not found in source: audio/${audioFile}`);
  const key = d.correctAnswers;
  const expl = (n) => text(d.answerExplanations?.[n]?.explanation ?? d.answerExplanations?.[String(n)]?.explanation ?? "") || undefined;
  const partKeys = Object.keys(d.partContent).sort((a, b) => Number(a) - Number(b));
  if (partKeys.join(",") !== "1,2,3,4") skip(`parts ${partKeys.join(",")} (expected 1–4)`);
  const parts = [];
  const partStarts = [];
  for (const pk of partKeys) {
    const root = frag(d.partContent[pk]);
    const flat = flattenSections(root);
    const sections = [];
    let cur = null;
    for (const el of flat) {
      if (el.classList.contains("q-section-title")) {
        cur = { titleEl: el, instr: [], content: [] };
        sections.push(cur);
      } else if (!cur) {
        if (el.querySelector("input, select, .drop-zone")) {
          // The paper starts with plain multiple-choice questions and no
          // "Questions …" header: open an untitled section for them (only radio
          // MCQs — anything else still can't be read without its instructions).
          const self = el.querySelectorAll("input");
          if (el.querySelector("select, .drop-zone") || ![...self].every((i) => i.type === "radio")) skip(`part ${pk}: inputs outside any question section`);
          const titleEl = DOC.createElement("div");
          titleEl.textContent = "Questions";
          const instrEl = DOC.createElement("p");
          instrEl.textContent = "Choose the correct letter.";
          cur = { titleEl, instr: [instrEl], content: [el], implicit: true };
          sections.push(cur);
          warnings.push(`part ${pk}: questions before the first section heading — grouped as multiple choice`);
        }
      } else if (el.classList.contains("q-instruction")) cur.instr.push(el);
      else if (el.classList.contains("dd-help-row")) continue;
      else cur.content.push(el);
    }
    const groups = [];
    let pendingTitle;
    for (const s of sections) {
      const all = s.content.flatMap((e) => [e, ...e.querySelectorAll("*")]);
      const q = (sel) => all.filter((e) => e.matches(sel));
      const texts = q('input[type="text"]');
      const radios = q('input[type="radio"]');
      const checks = q('input[type="checkbox"]');
      const selects = q("select");
      const drops = q(".drop-zone[data-drop], [data-drop].fc-dz, [data-drop].fc-dz-in");
      const instrLines = s.instr.flatMap((e) => htmlLines(e.innerHTML));
      const head = clean(s.titleEl.textContent).replace(/\s+/g, " ");
      const kinds = [texts.length && "text", radios.length && "radio", checks.length && "checkbox", selects.length && "select", drops.length && "drop"].filter(Boolean);
      if (!kinds.length) {
        // Umbrella heading ("Questions 21–26" + a caption) — its caption titles the next group.
        const cap = s.content.map((e) => clean(e.textContent).replace(/\s+/g, " ")).filter(Boolean).join(" ");
        if (cap) pendingTitle = cap;
        continue;
      }
      if (kinds.length > 1) skip(`part ${pk} "${head}": mixed answer types (${kinds.join("+")}) in one section`);
      const imgEl = all.find((e) => e.tagName === "IMG");
      const image = imgEl ? { src: imageUrl(imgEl.getAttribute("src"), warnings), alt: clean(imgEl.getAttribute("alt") ?? "") || "Map / diagram" } : undefined;
      const { instructions, answerRule } = splitInstr(instrLines.length ? instrLines : [head]);
      const letters = (raw) => answerList(raw, { split: false }).map((a) => a.toUpperCase());
      let g;
      const kind = kinds[0];
      addCount(stats.layout, kind + (image ? "+image" : "") + (kind === "radio" && all.some((e) => e.tagName === "TABLE") ? "+table" : ""));
      if (kind === "text" || kind === "drop") {
        const ns = (kind === "text" ? texts.map((e) => Number(e.dataset.question)) : drops.map((e) => Number(e.dataset.drop))).filter((n) => Number.isInteger(n));
        const { lines, titles } = linearize(s.content);
        const title = titles[0] ?? pendingTitle;
        if (kind === "text") {
          const rule = parseWordRule(instrLines.join(" "));
          g = {
            kind: "gap",
            instructions,
            ...(answerRule ? { answerRule } : {}),
            ...(rule.wordLimit != null ? { wordLimit: rule.wordLimit } : {}),
            ...(rule.allowNumber ? { allowNumber: true } : {}),
            title,
            template: lines.join("\n"),
            questions: ns.map((n) => {
              const a = answerList(key[n] ?? key[String(n)]);
              if (!a.length) skip(`Q${n}: no answer in the key`);
              return { n, answer: fitLimit(n, a, rule, warnings), explanation: expl(n) };
            }),
          };
        } else if (image && q(".map-pin[data-letter]").length) {
          // Map labelling by drag: each place (question) is dropped on a lettered pin
          // of the picture, so the answer is the pin's letter — a matching group whose
          // options are the letters drawn on the map.
          const keys = [...new Set(q(".map-pin[data-letter]").map((e) => e.dataset.letter))].sort();
          g = {
            kind: "matching",
            instructions,
            ...(title ? { title } : {}),
            options: keys.map((k) => ({ key: k, text: k })),
            questions: ns.map((n) => {
              const zone = drops.find((e) => Number(e.dataset.drop) === n);
              const item = clean(zone?.closest(".dd-row")?.querySelector(".dd-item")?.textContent ?? "").replace(/\s+/g, " ");
              if (!item) skip(`Q${n}: map place without a name`);
              const a = letters(key[n]);
              if (a.length !== 1 || !keys.includes(a[0])) skip(`Q${n}: answer ${JSON.stringify(key[n])} not among the map letters ${keys.join("")}`);
              return { n, text: item, answer: a, explanation: expl(n) };
            }),
          };
          const used = g.questions.map((x) => x.answer[0]);
          if (new Set(used).size !== used.length) g.allowReuse = true;
        } else {
          const chips = q(".drag-chip[data-letter]");
          const options = chips.map((c) => ({ key: c.dataset.letter, text: clean(c.textContent).replace(/\s+/g, " ") }));
          if (!options.length) skip(`part ${pk} "${head}": drag-and-drop without a word box`);
          const keys = options.map((o) => o.key);
          g = {
            kind: "gap-box",
            instructions,
            title,
            options,
            template: lines.join("\n"),
            questions: ns.map((n) => {
              const a = letters(key[n]);
              if (a.length !== 1 || !keys.includes(a[0])) skip(`Q${n}: drag answer ${JSON.stringify(key[n])} not in the box`);
              return { n, answer: a, explanation: expl(n) };
            }),
          };
        }
      } else if (kind === "checkbox") {
        // A pair / triple badge ("17–18", "28–30") carries the other numbers in
        // data-question-badge-alt, data-question-badge-alt2, …
        const badgeNs = [
          ...new Set(
            [s.titleEl, ...all]
              .flatMap((e) => [e, ...e.querySelectorAll("[data-question-badge]")])
              .flatMap((e) => Object.entries(e.dataset ?? {}).filter(([k]) => /^questionBadge(Alt\d*)?$/.test(k)).map(([, v]) => Number(v)))
              .filter(Number.isInteger)
          ),
        ].sort((a, b) => a - b);
        const range = /(\d+)\s*(?:–|-|&ndash;|and|to)\s*(\d+)/.exec(head);
        const ns = badgeNs.length ? badgeNs : range ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i) : [];
        if (!ns.length) skip(`part ${pk} "${head}": checkbox group without question numbers`);
        const names = new Set(checks.map((c) => c.name));
        if (names.size !== 1) skip(`part ${pk} "${head}": several checkbox groups in one section`);
        const options = checks.map((c) => ({ key: c.value, text: clean((c.closest("label") ?? c.parentElement).textContent).replace(/\s+/g, " ") }));
        const set = [...new Set(ns.flatMap((n) => letters(key[n])))].sort();
        if (set.length !== ns.length || !set.every((k) => options.some((o) => o.key === k))) skip(`Q${ns.join("+")}: choose-${ns.length} key ${JSON.stringify(set)} doesn't fit`);
        // Stem text without the question-number badges ("17–18", "24 25") and the
        // "Select exactly three options" hint; otherwise the stem is the instruction
        // line that isn't the "Choose TWO letters" rule.
        const stemText = (e) => {
          const c = e.cloneNode(true);
          c.querySelectorAll(".q-num-badge, [data-question-badge], .multi-hint").forEach((b) => b.remove());
          return clean(c.textContent).replace(/\s+/g, " ");
        };
        const isRule = (l) => /^Choose\s+(?:TWO|THREE|FOUR|FIVE)\b/i.test(l);
        const stemEl = s.content.flatMap((e) => [e, ...e.querySelectorAll("div, p")]).find((e) => !e.querySelector("input") && stemText(e) && !e.closest("label"));
        let stem = stemEl ? stemText(stemEl) : instrLines.filter((l) => !isRule(l)).join(" ");
        let instr0 = (stemEl ? null : instrLines.find(isRule)) ?? instrLines[0];
        if (!stem && instr0) {
          // One instruction line holding both: "Choose TWO letters, A–E. What do the speakers…?"
          const m = /^(Choose\s+(?:TWO|THREE|FOUR|FIVE)\s+(?:letters|answers)\b[^.]*\.)\s+(\S.*)$/i.exec(instr0);
          if (m) [instr0, stem] = [m[1], m[2]];
        }
        if (!stem) skip(`Q${ns[0]}: choose-two question without a stem`);
        g = {
          kind: "mcq-multi",
          instructions: instr0 ?? `Choose ${NUM_WORDS[ns.length]} letters.`,
          title: stem,
          options,
          questions: ns.map((n) => ({ n, answer: set, explanation: ns.map(expl).filter(Boolean).join(" ") || undefined })),
        };
      } else if (kind === "radio" && !all.some((e) => e.tagName === "TABLE")) {
        const ns = [...new Set(radios.map((r) => Number(r.dataset.question ?? /\d+/.exec(r.name)?.[0])))];
        g = {
          kind: "mcq",
          instructions,
          title: pendingTitle,
          questions: ns.map((n) => {
            const rs = radios.filter((r) => Number(r.dataset.question ?? /\d+/.exec(r.name)?.[0]) === n);
            const badge = all.find((e) => Number(e.dataset?.questionBadge) === n);
            const stemHost = badge?.parentElement;
            const stem = stemHost ? clean(stemHost.textContent).replace(/\s+/g, " ").replace(new RegExp(`^${n}\\s*`), "") : "";
            if (!stem) skip(`Q${n}: multiple choice without a stem`);
            const options = rs.map((r) => ({ key: r.value, text: clean((r.closest("label") ?? r.parentElement).textContent).replace(/\s+/g, " ") }));
            const a = letters(key[n]);
            if (a.length !== 1 || !options.some((o) => o.key === a[0])) skip(`Q${n}: answer ${JSON.stringify(key[n])} not among the options`);
            return { n, text: stem, options, answer: a, explanation: expl(n) };
          }),
        };
      } else {
        // radio grid (map / table) or dropdowns: matching against a shared letter list.
        const inputs = kind === "select" ? selects : radios;
        const ns = [...new Set(inputs.map((e) => Number(e.dataset.question ?? /\d+/.exec(e.name)?.[0])))].filter(Number.isInteger);
        const keys =
          kind === "select"
            ? [...selects[0].querySelectorAll("option")].map((o) => o.value).filter(Boolean)
            : [...new Set(radios.filter((r) => Number(r.dataset.question ?? /\d+/.exec(r.name)?.[0]) === ns[0]).map((r) => r.value))];
        const list = letterList(s.content);
        const named = keys.every((k) => list[k]);
        if (!named && !image) skip(`part ${pk} "${head}": matching letters ${keys.join("")} without option texts or a picture`);
        const options = keys.map((k) => ({ key: k, text: named ? list[k] : k }));
        const listTitleEl = s.content.flatMap((e) => [...e.querySelectorAll("p")]).find((e) => !e.querySelector("input, select") && clean(e.textContent).length < 80 && e.nextElementSibling?.querySelector?.("strong, b"));
        g = {
          kind: "matching",
          instructions,
          title: pendingTitle ?? (named && listTitleEl ? clean(listTitleEl.textContent) : undefined),
          options,
          questions: ns.map((n) => {
            const el = inputs.find((e) => Number(e.dataset.question ?? /\d+/.exec(e.name)?.[0]) === n);
            const row = el.closest("tr") ?? el.parentElement;
            const nameEl = row.querySelector(".mapq-name");
            let item = clean(nameEl ? nameEl.textContent : [...row.childNodes].filter((c) => !(c.nodeType === 1 && (c.matches("select, .q-num-badge") || c.querySelector?.("input")))).map((c) => c.textContent).join(" ")).replace(/\s+/g, " ");
            // Map / plan labelling: the item is the numbered gap drawn on the picture itself.
            if (!item && image) item = `Place ${n} on the ${/\bplan\b/i.test(instructions) ? "plan" : /\bmap\b/i.test(instructions) ? "map" : "picture"}`;
            if (!item) skip(`Q${n}: matching item without text`);
            const a = letters(key[n]);
            if (a.length !== 1 || !keys.includes(a[0])) skip(`Q${n}: answer ${JSON.stringify(key[n])} not among ${keys.join("")}`);
            return { n, text: item, answer: a, explanation: expl(n) };
          }),
        };
        const used = g.questions.map((x) => x.answer[0]);
        if (new Set(used).size !== used.length || /more than once/i.test(instrLines.join(" "))) g.allowReuse = true;
      }
      if (image) g.image = image;
      if (g.title === undefined) delete g.title;
      pendingTitle = undefined;
      groups.push(g);
    }
    // Transcript
    let transcript = "";
    let context = "";
    const scriptHtml = d.audioScripts?.[pk] ?? d.audioScripts?.[String(pk)];
    if (scriptHtml) {
      const sroot = frag(scriptHtml);
      sroot.querySelectorAll(".script-qnum").forEach((e) => e.remove());
      const ps = [...sroot.querySelectorAll("p")];
      const ts = ps.map((p) => Number(p.dataset.t)).filter((t) => Number.isFinite(t));
      if (ts.length) partStarts.push(Math.min(...ts));
      const instr = ps.find((p) => p.classList.contains("script-instruction"));
      if (instr) context = clean(instr.textContent).replace(/\s+/g, " ");
      transcript = ps
        .map((p) => clean(p.textContent).replace(/\s+/g, " "))
        .filter(Boolean)
        .join("\n");
    } else warnings.push(`part ${pk}: no transcript`);
    const cfg = d.partConfig?.[pk];
    parts.push({
      id: `cdi-listening-${pad2(num)}-part-${pk}`,
      title: `Part ${pk}`,
      context: context || text(cfg?.instructions ?? "") || `Listen and answer the questions for Part ${pk}.`,
      speakers: [],
      script: [],
      groups,
      ...(transcript ? { transcript } : {}),
    });
  }
  const questionTimes = {};
  for (const [k, v] of Object.entries(d.questionTimestamps ?? {})) if (Number.isFinite(Number(v))) questionTimes[Number(k)] = Number(v);
  if (!Object.keys(questionTimes).length) warnings.push("no question timestamps");
  const audio = { file: audioFile };
  const dur = fs.existsSync(audioPath) ? mp3Duration(audioPath) : null;
  if (dur) audio.durationSec = dur;
  if (partStarts.length === 4 && partStarts.every((t, i) => i === 0 || t > partStarts[i - 1])) audio.partStarts = partStarts;
  else warnings.push("part start times not derivable from the transcript");
  if (Object.keys(questionTimes).length) audio.questionTimes = questionTimes;
  const ctxs = parts.map((p) => p.context.replace(/^You will hear (an?|the|some|part of an?)?\s*/i, "").replace(/\.$/, ""));
  return {
    test: {
      format: "exam-v2",
      skill: "LISTENING",
      id: `cdi-listening-${pad2(num)}`,
      title: `CDI Listening Test ${pad2(num)}`,
      description: `A full Listening test from the CDI practice materials, with the original recording. ${parts.length} parts, 40 questions.`,
      difficulty: "Medium",
      topics: ctxs.filter((c) => c.length < 140),
      source: "cdi",
      parts,
      audio,
    },
    warnings,
  };
}

/** Duration of an MP3 (Xing/Info frame count when present, else CBR estimate from the first frame). */
function mp3Duration(file) {
  try {
    const fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(size, 256 * 1024));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    let off = 0;
    if (buf.toString("latin1", 0, 3) === "ID3") off = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
    while (off < buf.length - 4 && !(buf[off] === 0xff && (buf[off + 1] & 0xe0) === 0xe0)) off++;
    if (off >= buf.length - 4) return null;
    const h = buf.readUInt32BE(off);
    const ver = (h >> 19) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const brIdx = (h >> 12) & 15;
    const srIdx = (h >> 10) & 3;
    const mono = ((h >> 6) & 3) === 3;
    const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[ver];
    if (!SR || srIdx === 3 || brIdx === 0 || brIdx === 15) return null;
    const sr = SR[srIdx];
    const spf = ver === 3 ? 1152 : 576;
    const sideInfo = ver === 3 ? (mono ? 17 : 32) : mono ? 9 : 17;
    const x = off + 4 + sideInfo;
    const tag = buf.toString("latin1", x, x + 4);
    if ((tag === "Xing" || tag === "Info") && buf.readUInt32BE(x + 4) & 1) return Math.round((buf.readUInt32BE(x + 8) * spf) / sr);
    if (buf.toString("latin1", off + 36, off + 40) === "VBRI") return Math.round((buf.readUInt32BE(off + 36 + 14) * spf) / sr);
    const br = (ver === 3 ? BR1 : BR2)[brIdx] * 1000;
    return Math.round(((size - off) * 8) / br);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WRITING
// ---------------------------------------------------------------------------

function task1Type(t) {
  const s = t.toLowerCase();
  const kinds = [
    [/\bmaps?\b|\bplans?\b|\blayout\b/, "Map"],
    [/\bprocess|diagram|stages|how .* (is|are) (made|produced)/, "Process"],
    [/\bpie\b/, "Pie Chart"],
    [/\bline (graph|chart)/, "Line Graph"],
    [/\bbar (chart|graph)/, "Bar Chart"],
    [/\btables?\b/, "Table"],
  ].filter(([re]) => re.test(s));
  if (kinds.length > 1) return "Mixed Charts";
  return kinds[0]?.[1] ?? "Chart";
}

function task2Type(t) {
  const s = t.toLowerCase();
  if (/discuss both/.test(s)) return /opinion/.test(s) ? "Discussion + Opinion" : "Discussion";
  if (/advantages?.*disadvantages?|outweigh/.test(s)) return "Advantages/Disadvantages";
  if (/(agree or disagree|to what extent)/.test(s)) return "Opinion";
  if (/(problems?|causes?|reasons?).*(solutions?|measures|what can be done|how can)/.test(s)) return "Problem-Solution";
  if (/positive or (a )?negative/.test(s)) return "Positive/Negative";
  if ((s.match(/\?/g) ?? []).length >= 2) return "Two-part Question";
  return "Opinion";
}

const STRATEGY = {
  task1: {
    en: "Paragraph 1: paraphrase the question. Paragraph 2: an overview of the main trends or features. Paragraphs 3–4: key details with figures and comparisons. Don't give your opinion.",
    uz: "1-abzas: savolni oʻz soʻzlaringiz bilan qayta yozing. 2-abzas: asosiy tendensiya yoki xususiyatlar boʻyicha umumiy xulosa. 3–4-abzas: raqamlar va taqqoslashlar bilan asosiy tafsilotlar. Oʻz fikringizni yozmang.",
  },
  task2: {
    en: "Introduction: paraphrase the topic and state your position. Two body paragraphs, each with one main idea, an explanation and an example. Conclusion: restate your view.",
    uz: "Kirish: mavzuni oʻz soʻzlaringiz bilan qayta yozing va pozitsiyangizni bildiring. Ikkita asosiy abzas: har birida bitta asosiy fikr, izoh va misol. Xulosa: fikringizni yana bir bor qisqa bayon qiling.",
  },
};

function tokens(s) {
  return new Set(
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

function convertWritingTask(file, html) {
  const warnings = [];
  const d = evalDecls(html, ["testData"]);
  const td = d.testData;
  if (!td?.task1 || !td?.task2) skip("testData with task1/task2 not readable");
  const num = Number(/(\d+)/.exec(file)[1]);
  const out = {};
  for (const tk of ["task1", "task2"]) {
    const t = td[tk];
    const box = frag(t.content);
    const img = box.querySelector("img");
    const lines = [...box.querySelectorAll("h3, h4, p, li")].map((e) => clean(e.textContent).replace(/\s+/g, " ")).filter(Boolean);
    const topic = text(t.topicText ?? "");
    if (!topic) skip(`${tk}: no topic text`);
    if (tk === "task1" && !img) skip("task1 without a picture");
    const minWords = Number(t.minWords) || (tk === "task1" ? 150 : 250);
    const body = lines.filter((l) => !/^Write about the following topic:?$/i.test(l) && !/^Write at least \d+ words\.?$/i.test(l));
    const promptLines = [...new Set(body.length ? body : [topic])];
    const prompt = [...promptLines, `Write at least ${minWords} words.`].join("\n\n");
    const type = tk === "task1" ? task1Type(topic) : task2Type(topic);
    out[tk] = {
      id: `cdi-writing-${pad2(num)}-${tk === "task1" ? "t1" : "t2"}`,
      title: `CDI Writing ${pad2(num)} · ${tk === "task1" ? "Task 1" : "Task 2"}: ${type}`,
      prompt,
      type,
      ...(img ? { imageUrl: imageUrl(img.getAttribute("src"), warnings) } : {}),
      sampleAnswer: "",
      usefulPhrases: [],
      strategyEn: STRATEGY[tk].en,
      strategyUz: STRATEGY[tk].uz,
      _topic: topic,
      _alt: img ? clean(img.getAttribute("alt") ?? "") : undefined,
    };
    if (img && !clean(img.getAttribute("alt") ?? "")) warnings.push(`${tk}: picture has no alt text`);
  }
  return { prompts: out, warnings };
}

function readSample(file, html) {
  const doc = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")).window.document;
  const ps = [...doc.querySelectorAll("p, div, blockquote, h1, h2, h3, h4")];
  const own = (e) => clean([...e.childNodes].filter((c) => c.nodeType === 3 || (c.nodeType === 1 && /^(STRONG|B|EM|I|SPAN|A|MARK|U)$/.test(c.tagName))).map((c) => c.textContent).join(" ")).replace(/\s+/g, " ");
  const label = ps.find((e) => /^(Topic|Topic Question|Essay Question|Question):?$/i.test(own(e)));
  let topic = "";
  if (label) {
    let n = label.nextElementSibling;
    while (n && !own(n)) n = n.nextElementSibling;
    if (n) topic = own(n);
    if (!topic) {
      const after = ps.slice(ps.indexOf(label) + 1).find((e) => own(e).split(" ").length > 8);
      topic = after ? own(after) : "";
    }
  }
  topic = topic.replace(/^["“]|["”]$/g, "").trim();
  if (!topic) skip("topic not found");
  // The answer: long paragraphs after the topic, from the same container as the first one.
  const start = ps.findIndex((e) => own(e) && own(e).replace(/^["“]|["”]$/g, "").trim() === topic);
  const long = ps.slice(start + 1).filter((e) => e.tagName === "P" && own(e).split(" ").length >= 25);
  if (!long.length) skip("model answer not found");
  const host = long[0].parentElement;
  const paras = long.filter((e) => e.parentElement === host).map(own);
  const words = paras.join(" ").split(/\s+/).length;
  if (words < 120) skip(`model answer too short (${words} words)`);
  const task = /task\s*1|summari[sz]e the information/i.test(topic + " " + doc.title) ? "task1" : "task2";
  return { topic, answer: paras.join("\n\n"), words, task, title: clean(doc.title) };
}

// ---------------------------------------------------------------------------
// Skips that were checked by hand against the source HTML: the cause is in the
// source data, not in this converter. Written to report.json as `note`.
// ---------------------------------------------------------------------------

const SKIP_NOTES = {
  "Reading-06.html": "Q27–32 key is YES/NO/NOT GIVEN but the paper (instructions, buttons, question type) is TRUE/FALSE/NOT GIVEN",
  "Reading-30.html": "Q37 key G is outside the paper's A–E list",
  "Reading-31.html": "Q24 key 'gravity' is not in the passage",
  "Reading-33.html": "Q19 is missing from the source (39 questions)",
  "Reading-35.html": "Q27–32 are YES/NO/NOT GIVEN statements laid out as A–D multiple choice with no options",
  "Reading-36.html": "Q23–26 key is YES/NO/NOT GIVEN but the paper is TRUE/FALSE/NOT GIVEN throughout",
  "Reading-38.html": "Q27 is an empty placeholder (39 real questions)",
  "Reading-42.html": "Q40 is missing from the source (39 questions)",
  "Reading-44.html": "Q7 'irrigation' and Q23 'civilisation' are not in the passage",
  "Reading-48.html": "Q32 key 'letters and numbers' is not in the passage",
  "Reading-52.html": "Q2 key '400' is not in the passage",
  "Reading-56.html": "Q7 key 'radiocarbon dating' breaks the paper's ONE WORD ONLY rule",
  "Reading-69.html": "Q40 is missing from the source (39 questions)",
  "Listening-11.html": "4 gap keys are written differently in the transcript (more than the 3 tolerated)",
  "Listening-15.html": "transcripts for Parts 2 and 4 are placeholders; question numbers have gaps",
  "Listening-16.html": "all four transcripts are 'will be added' placeholders",
  "Listening-18.html": "Part 3 has no questions; Parts 3–4 transcripts are placeholders",
  "Listening-20.html": "all four transcripts are 'will be added' placeholders",
  "Listening-21.html": "all four transcripts are 'will be added' placeholders",
  "Listening-26.html": "20 gap keys are not in the transcript (transcript and key don't belong together)",
  "Listening-34.html": "Part 2 picture is hot-linked from another website, not in the source images",
  "Listening-37.html": "Q10 has more than 5 options (not an IELTS multiple-choice format)",
  "Listening-39.html": "Q35 key 'British Airways' breaks the paper's ONE WORD ONLY rule",
  "Listening-52.html": "49 questions (13 per part) — not an IELTS-format paper",
  "Listening-53.html": "49 questions (13 per part) — not an IELTS-format paper",
  "Listening-54.html": "49 questions (13 per part) — not an IELTS-format paper",
  "Listening-55.html": "46 questions (13 in Parts 3–4) — not an IELTS-format paper",
  "Listening-57.html": "49 questions (13 per part) — not an IELTS-format paper",
  "Listening-60.html": "all four transcripts are 'will be added' placeholders",
  "Listening-64.html": "7 gap keys are written differently in the transcript (more than the 3 tolerated)",
};

// ---------------------------------------------------------------------------
// lib/ielts/content/cdi/index.ts — generated from the files this run wrote, so
// the catalog never misses (or references a stale) converted test.
// ---------------------------------------------------------------------------

function writeIndex(readingIds, listeningIds) {
  const varName = (id) => (id.startsWith("cdi-reading-") ? "r" : "l") + id.replace(/^cdi-(reading|listening)-/, "");
  const byNum = (a, b) => Number(/\d+$/.exec(a)[0]) - Number(/\d+$/.exec(b)[0]);
  const reading = [...readingIds].sort(byNum);
  const listening = [...listeningIds].sort(byNum);
  const wrap = (ids) => {
    const names = ids.map(varName);
    const rows = [];
    for (let i = 0; i < names.length; i += 20) rows.push(`  ${names.slice(i, i + 20).join(", ")},`);
    return rows.join("\n");
  };
  const src = `import "server-only";

/**
 * CDI practice materials (imported by scripts/cdi/import.mjs): ${reading.length} Academic
 * Reading papers, ${listening.length} Listening papers with real recordings, and Writing
 * Task 1 / Task 2 prompts. They replace the built-in Averna / legacy tests in
 * every student and teacher list (lib/ielts/catalog.ts).
 *
 * GENERATED by scripts/cdi/import.mjs from the files it wrote — don't edit by
 * hand; re-run the converter instead.
 *
 * SERVER ONLY: the JSON holds every answer key and Listening transcript, so the
 * "server-only" guard turns any client import into a build error. Students get
 * these tests through the sanitisers (lib/ielts/sanitize.ts) like any other.
 * Static imports (not fs) so the files are bundled with the server code.
 */

import type { ExamListeningTest, ExamReadingTest } from "../../types";
import type { WritingPrompt } from "@/lib/writing-data";
import { byCdiNumber } from "../../listing";
import writing from "./writing.json";
${reading.map((id) => `import ${varName(id)} from "./reading/${id}.json";`).join("\n")}
${listening.map((id) => `import ${varName(id)} from "./listening/${id}.json";`).join("\n")}

const byNumber = byCdiNumber;

export const CDI_READING: ExamReadingTest[] = byNumber([
${wrap(reading)}
] as unknown as ExamReadingTest[]);

export const CDI_LISTENING: ExamListeningTest[] = byNumber([
${wrap(listening)}
] as unknown as ExamListeningTest[]);

const w = writing as unknown as { task1: WritingPrompt[]; task2: WritingPrompt[] };
export const CDI_WRITING: Record<"task1" | "task2", WritingPrompt[]> = { task1: byNumber(w.task1), task2: byNumber(w.task2) };
`;
  fs.writeFileSync(path.join(OUT, "index.ts"), src);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const validators = await loadValidators();
  const report = {
    generatedAt: new Date().toISOString(),
    source: path.basename(SRC),
    validators: validators ? "lib/ielts/validate.ts (bundled)" : "unavailable",
    validatorException:
      "Listening parts carry the real recording (test.audio) and leave speakers/script empty; validateListeningPart requires a non-empty speakers list and a script of at least 4 lines. Validation substitutes the transcript for the script (scripts/cdi/import.mjs listeningForValidation, tests/cdi-content.test.ts) so every other rule — including 'gap answer appears in the script' — still runs.",
    reading: { converted: 0, skipped: 0, files: [] },
    listening: { converted: 0, skipped: 0, files: [] },
    writing: { converted: 0, skipped: 0, files: [], samples: [], unmatchedSamples: [] },
    questionTypes: { reading: {}, readingLayout: {}, listeningLayout: {}, examKinds: { reading: {}, listening: {} } },
    images: { count: 0, bytes: 0, files: [] },
    json: { files: 0, bytes: 0, readingAvgBytes: 0, listeningAvgBytes: 0 },
  };
  const files = fs.readdirSync(SRC);
  const pick = (re) => files.filter((f) => re.test(f)).sort((a, b) => Number(/\d+/.exec(a)) - Number(/\d+/.exec(b)));

  for (const dir of ["reading", "listening"]) {
    fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  }
  fs.rmSync(OUT_IMG, { recursive: true, force: true });

  const sizes = { reading: [], listening: [] };
  const writeJson = (rel, data) => {
    const s = JSON.stringify(data, null, 1) + "\n";
    fs.writeFileSync(path.join(OUT, rel), s);
    report.json.files++;
    report.json.bytes += Buffer.byteLength(s);
    return Buffer.byteLength(s);
  };
  const kindCount = (test, bucket) => test.parts.forEach((p) => p.groups.forEach((g) => addCount(bucket, g.kind, g.questions.length)));

  // READING
  for (const f of pick(/^Reading-\d+\.html$/)) {
    const html = fs.readFileSync(path.join(SRC, f), "utf8");
    const stats = { qtypes: {}, layout: {} };
    const before = new Map(usedImages);
    try {
      const { test, warnings } = convertReading(f, html, stats);
      if (validators) {
        const r = validators.validateReadingTest(test, { requireFull: true });
        if (r.errors.length) skip(`validator: ${r.errors.slice(0, 3).join(" · ")}${r.errors.length > 3 ? ` (+${r.errors.length - 3} more)` : ""}`);
        warnings.push(...r.warnings.map((w) => `validator: ${w}`));
      }
      const bytes = writeJson(path.join("reading", `${test.id}.json`), test);
      sizes.reading.push(bytes);
      Object.entries(stats.qtypes).forEach(([k, v]) => addCount(report.questionTypes.reading, k, v));
      Object.entries(stats.layout).forEach(([k, v]) => addCount(report.questionTypes.readingLayout, k, v));
      kindCount(test, report.questionTypes.examKinds.reading);
      report.reading.converted++;
      report.reading.files.push({ file: f, status: "ok", id: test.id, bytes, warnings });
    } catch (e) {
      if (!(e instanceof Skip)) throw new Error(`${f}: ${e.stack}`);
      usedImages.clear();
      before.forEach((v, k) => usedImages.set(k, v));
      report.reading.skipped++;
      report.reading.files.push({ file: f, status: "skipped", reason: e.message, ...(SKIP_NOTES[f] ? { note: SKIP_NOTES[f] } : {}) });
    }
  }

  // LISTENING
  for (const f of pick(/^Listening-\d+\.html$/)) {
    const html = fs.readFileSync(path.join(SRC, f), "utf8");
    const stats = { layout: {} };
    const before = new Map(usedImages);
    try {
      const { test, warnings } = convertListening(f, html, stats);
      if (validators) {
        const r = validators.validateListeningTest(listeningForValidation(test), { requireFull: true });
        // The transcript writes some keys differently from the answer sheet
        // (phone numbers grouped, dates spelled out). A few such misses are
        // tolerated and reported; more than MAX_TRANSCRIPT_MISSES means the
        // transcript and key don't belong together → skip.
        const misses = r.errors.filter((e) => /does not appear in the script/.test(e));
        const errors = r.errors.filter((e) => !misses.includes(e));
        if (misses.length > MAX_TRANSCRIPT_MISSES) errors.unshift(`${misses.length} gap answers not in the transcript: ${misses.slice(0, 2).join(" · ")}`);
        else warnings.push(...misses.map((m) => `transcript: ${m}`));
        if (errors.length) skip(`validator: ${errors.slice(0, 3).join(" · ")}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ""}`);
        warnings.push(...r.warnings.filter((w) => !/script is short/.test(w)).map((w) => `validator: ${w}`));
      }
      const bytes = writeJson(path.join("listening", `${test.id}.json`), test);
      sizes.listening.push(bytes);
      Object.entries(stats.layout).forEach(([k, v]) => addCount(report.questionTypes.listeningLayout, k, v));
      kindCount(test, report.questionTypes.examKinds.listening);
      report.listening.converted++;
      report.listening.files.push({ file: f, status: "ok", id: test.id, bytes, audio: test.audio.file, durationSec: test.audio.durationSec, warnings });
    } catch (e) {
      if (!(e instanceof Skip)) throw new Error(`${f}: ${e.stack}`);
      usedImages.clear();
      before.forEach((v, k) => usedImages.set(k, v));
      report.listening.skipped++;
      report.listening.files.push({ file: f, status: "skipped", reason: e.message, ...(SKIP_NOTES[f] ? { note: SKIP_NOTES[f] } : {}) });
    }
  }

  // WRITING
  const writing = { task1: [], task2: [] };
  for (const f of pick(/^Writing-Task-\d+\.html$/)) {
    const html = fs.readFileSync(path.join(SRC, f), "utf8");
    const before = new Map(usedImages);
    try {
      const { prompts, warnings } = convertWritingTask(f, html);
      writing.task1.push(prompts.task1);
      writing.task2.push(prompts.task2);
      report.writing.converted++;
      report.writing.files.push({ file: f, status: "ok", ids: [prompts.task1.id, prompts.task2.id], types: [prompts.task1.type, prompts.task2.type], warnings });
    } catch (e) {
      if (!(e instanceof Skip)) throw new Error(`${f}: ${e.stack}`);
      usedImages.clear();
      before.forEach((v, k) => usedImages.set(k, v));
      report.writing.skipped++;
      report.writing.files.push({ file: f, status: "skipped", reason: e.message, ...(SKIP_NOTES[f] ? { note: SKIP_NOTES[f] } : {}) });
    }
  }
  // Same topic used by several CDI files → note duplicates.
  for (const tk of ["task1", "task2"]) {
    const seen = new Map();
    for (const p of writing[tk]) {
      const k = p._topic.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(k)) report.writing.files.find((x) => x.ids?.includes(p.id))?.warnings.push(`${tk} topic duplicates ${seen.get(k)}`);
      else seen.set(k, p.id);
    }
  }
  for (const f of pick(/^Writing-Sample-.+\.html$/)) {
    const html = fs.readFileSync(path.join(SRC, f), "utf8");
    try {
      const s = readSample(f, html);
      const candidates = writing[s.task].map((p) => ({ p, score: similarity(s.topic, p._topic) })).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (best && best.score >= 0.8) {
        const matches = candidates.filter((c) => c.score >= 0.8).map((c) => c.p);
        for (const p of matches) p.sampleAnswer = s.answer;
        report.writing.samples.push({ file: f, task: s.task, words: s.words, attachedTo: matches.map((p) => p.id), score: Number(best.score.toFixed(2)) });
      } else {
        report.writing.unmatchedSamples.push({ file: f, task: s.task, title: s.title, topic: s.topic, words: s.words, bestScore: best ? Number(best.score.toFixed(2)) : 0, answer: s.answer });
      }
    } catch (e) {
      if (!(e instanceof Skip)) throw new Error(`${f}: ${e.stack}`);
      report.writing.unmatchedSamples.push({ file: f, status: "skipped", reason: e.message, ...(SKIP_NOTES[f] ? { note: SKIP_NOTES[f] } : {}) });
    }
  }
  for (const tk of ["task1", "task2"]) for (const p of writing[tk]) {
    delete p._topic;
    delete p._alt;
  }
  writeJson("writing.json", writing);

  // IMAGES
  for (const [rel, url] of [...usedImages.entries()].sort()) {
    const from = path.join(SRC, "images", ...rel.split("/"));
    const to = path.join(OUT_IMG, ...rel.split("/"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    const bytes = fs.statSync(to).size;
    report.images.count++;
    report.images.bytes += bytes;
    report.images.files.push({ file: url, bytes });
  }

  writeIndex(
    report.reading.files.filter((f) => f.status === "ok").map((f) => f.id),
    report.listening.files.filter((f) => f.status === "ok").map((f) => f.id)
  );

  const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
  report.json.readingAvgBytes = avg(sizes.reading);
  report.json.listeningAvgBytes = avg(sizes.listening);
  report.elapsedMs = Date.now() - t0;
  const rs = JSON.stringify(report, null, 1) + "\n";
  fs.writeFileSync(path.join(OUT, "report.json"), rs);

  console.log(
    `Reading ${report.reading.converted} ok / ${report.reading.skipped} skipped · Listening ${report.listening.converted} ok / ${report.listening.skipped} skipped · Writing ${report.writing.converted} ok / ${report.writing.skipped} skipped · samples attached ${report.writing.samples.length}, unmatched ${report.writing.unmatchedSamples.length}`
  );
  console.log(`JSON ${report.json.files} files, ${(report.json.bytes / 1024 / 1024).toFixed(2)} MB · images ${report.images.count}, ${(report.images.bytes / 1024).toFixed(0)} KB · ${report.elapsedMs} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
