#!/usr/bin/env node
/**
 * Compact-spacing codemod (kept for reference; already applied once).
 *
 * Tightens page rhythm across app/** and components/** by rewriting exact
 * Tailwind tokens inside class strings only:
 *   - JSX `className="…"` / `*ClassName="…"` attributes,
 *   - every string / template literal inside `className={…}` expressions and
 *     `cn(…)` / `clsx(…)` calls (conditional logic is left untouched),
 *   - `pt-6` on <CardContent> / <CardHeader> (header-less card pattern).
 * Tokens are whitespace-delimited; a template chunk glued to `${…}` is never
 * touched, nor are variants that are not listed (`print:mb-8`, `-mt-8`, …).
 *
 * Usage: node scripts/codemods/compact-spacing.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry");

/** Carefully tuned / out-of-scope surfaces (paths relative to the repo root). */
const EXCLUDE = [
  /^components\/ui\//, // shared primitives are tuned by hand
  /^components\/exam\//, // exam runners (layout covered by tests)
  /^components\/placement\/(placement-orchestrator|grammar-runner|writing-runner)\.tsx$/, // placement test runner
  /^components\/group-mock\/session-ui\.tsx$/, // live group mock session
  /^components\/articles\/interactive-lesson\.tsx$/, // interactive article iframe view
  /^components\/logo\.tsx$/, // landing page component
  /^components\/certificate-view\.tsx$/, // print layout
  /^app\/page\.tsx$/, // public landing page
  /^app\/auth\//,
  /^app\/certificate\//, // print layout
  /^app\/messages\//, // thread height is calc() against the container padding
  /^app\/learning\/(listening|reading)\/\[testId\]\//,
  /^app\/learning\/speaking-test\/\[setId\]\//,
  /^app\/learning\/mock-exam\/\[examId\]\//,
  /^app\/learning\/mock-exam\/group\//,
  /^app\/learning\/writing\/exam\//,
  /^app\/learning\/placement\/\[attemptId\]\//,
  /(opengraph|twitter)-image\.tsx$/,
];

const BP = ["sm", "md", "lg", "xl", "2xl"];

/**
 * Single-token rules. `add` is an optional responsive companion; it is skipped
 * when the same literal already sets that property at an equal or smaller
 * breakpoint (it would fight or flatten the existing responsive steps).
 */
const SINGLE = {
  "sm:py-8": { to: "sm:py-6" },
  "py-8": { to: "py-6", needsContainer: true },
  "space-y-8": { to: "space-y-6" },
  "space-y-6": { to: "space-y-4", add: "sm:space-y-5" },
  "gap-6": { to: "gap-4", add: "lg:gap-5" },
  "md:gap-6": { to: "md:gap-4", add: "lg:gap-5" },
  "sm:gap-6": { to: "sm:gap-4" },
  "mb-8": { to: "mb-6" },
  "mt-8": { to: "mt-6" },
};

/** Pair rules: both tokens in the same literal → rewritten together (checked first). */
const PAIRS = [
  { name: "py-6 sm:py-8", a: "py-6", b: "sm:py-8", toA: "py-4", toB: "sm:py-6" },
  { name: "pb-10 lg:pb-8", a: "pb-10", b: "lg:pb-8", toA: "pb-8", toB: "lg:pb-6" },
  { name: "gap-4 md:gap-6", a: "gap-4", b: "md:gap-6", toA: "gap-3", toB: "md:gap-4", add: "lg:gap-5" },
];

/** Header-less card pattern, only on <CardContent> / <CardHeader>. */
const CARD = { "pt-6": { to: "pt-4", add: "sm:pt-5" } };

/** Utilities that set the same CSS property as a companion's utility. */
const FAMILY = { "space-y": ["space-y"], gap: ["gap"], pt: ["p", "py", "pt"] };

const stats = new Map(); // pattern → count
const perFile = [];

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function splitVariant(token) {
  const i = token.lastIndexOf(":");
  return i < 0 ? { bp: null, util: token } : { bp: token.slice(0, i), util: token.slice(i + 1) };
}

function utilProp(util) {
  if (/^gap-(?![xy]-)/.test(util)) return "gap";
  if (util.startsWith("space-y-")) return "space-y";
  const m = /^(p|py|pt)-/.exec(util);
  return m ? m[1] : null;
}

/** Would `companion` fight a responsive token the literal already has? */
function companionBlocked(companion, tokens, ownIdx) {
  if (tokens.includes(companion)) return true;
  const { bp, util } = splitVariant(companion);
  const family = FAMILY[utilProp(util)] ?? [];
  const limit = BP.indexOf(bp);
  return tokens.some((t, i) => {
    if (ownIdx.has(i)) return false;
    const v = splitVariant(t);
    if (!v.bp || !BP.includes(v.bp) || BP.indexOf(v.bp) > limit) return false;
    return family.includes(utilProp(v.util));
  });
}

/**
 * Rewrite one literal's text. `glued` = [left, right]: the edge token touches a
 * template interpolation and must stay as-is. Returns the new text.
 */
function rewrite(text, { container, card, glued, counts }) {
  const parts = text.split(/(\s+)/); // keep separators
  const idx = []; // indices of tokens in parts
  parts.forEach((p, i) => p && !/^\s+$/.test(p) && idx.push(i));
  const tokens = idx.map((i) => parts[i]);
  const locked = new Set();
  if (glued[0] && idx.length && idx[0] === 0) locked.add(0);
  if (glued[1] && idx.length && idx[idx.length - 1] === parts.length - 1) locked.add(tokens.length - 1);

  const out = [...tokens];
  const done = new Set();
  const adds = [];

  for (const pair of PAIRS) {
    const ia = tokens.findIndex((t, i) => t === pair.a && !locked.has(i) && !done.has(i));
    const ib = tokens.findIndex((t, i) => t === pair.b && !locked.has(i) && !done.has(i));
    if (ia < 0 || ib < 0) continue;
    out[ia] = pair.toA;
    out[ib] = pair.toB;
    done.add(ia).add(ib);
    if (pair.add) adds.push({ after: ib, token: pair.add, own: [ia, ib] });
    bump(counts, pair.name);
  }

  tokens.forEach((t, i) => {
    if (done.has(i) || locked.has(i)) return;
    const rule = (card && CARD[t]) || SINGLE[t];
    if (!rule) return;
    if (rule.needsContainer && !container) return;
    out[i] = rule.to;
    done.add(i);
    if (rule.add) adds.push({ after: i, token: rule.add, own: [i] });
    bump(counts, `${t} -> ${rule.to}${rule.add ? " " + rule.add : ""}`);
  });

  if (!done.size) return text;
  const added = [];
  for (const a of adds) {
    if (companionBlocked(a.token, [...out, ...added], new Set(a.own))) {
      bump(counts, `(companion ${a.token} skipped)`);
      continue;
    }
    added.push(a.token);
    out[a.after] = `${out[a.after]} ${a.token}`;
  }
  idx.forEach((pi, ti) => (parts[pi] = out[ti]));
  return parts.join("");
}

/* ---------- a tiny JS/JSX-expression scanner ---------- */

/** Scan a quoted string starting at src[i] (the quote). Returns end index (after closing quote). */
function scanQuoted(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q) j += src[j] === "\\" ? 2 : 1;
  return j + 1;
}

/**
 * Scan a template literal starting at src[i] (the backtick). Pushes static
 * chunks to `segs` and recurses into interpolations. Returns end index.
 */
function scanTemplate(src, i, segs) {
  let j = i + 1;
  let chunkStart = j;
  let leftGlued = false;
  while (j < src.length) {
    if (src[j] === "\\") {
      j += 2;
      continue;
    }
    if (src[j] === "`") {
      segs.push({ start: chunkStart, end: j, glued: [leftGlued, false] });
      return j + 1;
    }
    if (src[j] === "$" && src[j + 1] === "{") {
      segs.push({ start: chunkStart, end: j, glued: [leftGlued, true] });
      j = scanBalanced(src, j + 1, "{", "}", segs);
      chunkStart = j;
      leftGlued = true;
      continue;
    }
    j++;
  }
  return j;
}

/** Scan from src[i] === open to its matching close. Collects literal segments. Returns index after close. */
function scanBalanced(src, i, open, close, segs) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'") {
      const end = scanQuoted(src, j);
      segs.push({ start: j + 1, end: end - 1, glued: [false, false] });
      j = end;
      continue;
    }
    if (c === "`") {
      j = scanTemplate(src, j, segs);
      continue;
    }
    if (c === "/" && src[j + 1] === "/") {
      j = src.indexOf("\n", j);
      if (j < 0) return src.length;
      continue;
    }
    if (c === "/" && src[j + 1] === "*") {
      j = src.indexOf("*/", j) + 2;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth === 0 && c === close) return j + 1;
    }
    j++;
  }
  return j;
}

/** Byte ranges of `className` attributes that sit directly on <CardContent> / <CardHeader>. */
function cardClassNamePositions(src) {
  const pos = new Set();
  const re = /<(CardContent|CardHeader)\b/g;
  let m;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length;
    while (j < src.length) {
      const c = src[j];
      if (c === ">" || (c === "/" && src[j + 1] === ">")) break;
      if (c === "{") {
        j = scanBalanced(src, j, "{", "}", []);
        continue;
      }
      if (c === '"' || c === "'") {
        j = scanQuoted(src, j);
        continue;
      }
      if (src.startsWith("className=", j) && /\s/.test(src[j - 1])) pos.add(j);
      j++;
    }
  }
  return pos;
}

function transformFile(src, counts) {
  const cardPos = cardClassNamePositions(src);
  const edits = [];
  const re = /\b(?:[A-Za-z]*[cC]lassName=|(?:cn|clsx)\()/g;
  let m;
  while ((m = re.exec(src))) {
    const at = m.index;
    const isCall = m[0].endsWith("(");
    let segs = [];
    let end;
    if (isCall) {
      if (/[\w$.]/.test(src[at - 1] ?? "")) continue; // foo.cn( / mycn(
      end = scanBalanced(src, at + m[0].length - 1, "(", ")", segs);
    } else {
      const v = at + m[0].length;
      if (src[v] === '"' || src[v] === "'") {
        end = scanQuoted(src, v);
        segs = [{ start: v + 1, end: end - 1, glued: [false, false] }];
      } else if (src[v] === "{") {
        end = scanBalanced(src, v, "{", "}", segs);
      } else continue;
    }
    const all = segs.map((s) => src.slice(s.start, s.end)).join(" ").split(/\s+/);
    const container = all.includes("container") || all.includes("mx-auto");
    const card = !isCall && cardPos.has(at);
    for (const s of segs) {
      const text = src.slice(s.start, s.end);
      const next = rewrite(text, { container, card, glued: s.glued, counts });
      if (next !== text) edits.push({ start: s.start, end: s.end, text: next });
    }
    re.lastIndex = end; // regions never overlap (cn( inside className={…} is covered)
  }
  let out = src;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))]) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const src = readFileSync(file, "utf8");
  const counts = new Map();
  const out = transformFile(src, counts);
  if (out === src) continue;
  changed++;
  for (const [k, v] of counts) for (let i = 0; i < v; i++) bump(stats, k);
  perFile.push(`${rel}: ${[...counts].map(([k, v]) => `${k} x${v}`).join(", ")}`);
  if (!DRY) writeFileSync(file, out);
}

console.log(perFile.join("\n"));
console.log(`\n${changed} file(s) ${DRY ? "would change" : "changed"}. Replacements per pattern:`);
for (const [k, v] of [...stats].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
