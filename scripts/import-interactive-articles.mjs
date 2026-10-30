#!/usr/bin/env node
/**
 * Imports the interactive Intermediate lessons (one self-contained HTML file each)
 * into the Articles library WITHOUT changing them:
 *
 *   node scripts/import-interactive-articles.mjs "<folder with 01-….html … 13-….html>"
 *
 * - copies every file byte-for-byte to content/articles/intermediate/ (same name);
 * - writes lib/articles/interactive.json with metadata only (title, topic, counts,
 *   source file name and SHA-256).
 *
 * Metadata is read by evaluating ONLY the `window.UNIT = …` script of each file in a
 * fresh node:vm context ({ window: {} }). This is offline tooling; the app never
 * evaluates lesson code on the server. The lesson engine itself runs only in the
 * student's browser, inside a sandboxed frame (docs/articles-library.md).
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "content", "articles", "intermediate");
const OUT = join(ROOT, "lib", "articles", "interactive.json");
const EXPECTED = 13;

function fail(message) {
  console.error(`import-interactive-articles: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Words in the lesson's reading text. Sections are { h, e, pic, p: string[] }; "[[shown|lemma]]" marks a key word. */
function countReadingWords(article) {
  const plain = (s) => String(s ?? "").replace(/\[\[([^\]|]*)(?:\|[^\]]*)?\]\]/g, "$1");
  let words = 0;
  for (const section of article?.sections ?? []) {
    for (const text of [section.h, ...(section.p ?? [])]) {
      words += plain(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    }
  }
  return words;
}

const folder = process.argv[2];
assert(folder, 'usage: node scripts/import-interactive-articles.mjs "<folder>"');
const files = readdirSync(folder).filter((f) => /^\d{2}-[a-z0-9-]+\.html$/.test(f)).sort();
assert(files.length === EXPECTED, `expected ${EXPECTED} lesson files (NN-name.html), found ${files.length}`);

const structuredSlugs = new Set(JSON.parse(readFileSync(join(ROOT, "lib", "articles", "catalog.json"), "utf8")).map((a) => a.slug));
mkdirSync(DEST, { recursive: true });

let engine = null;
const lessons = [];
for (const file of files) {
  const bytes = readFileSync(join(folder, file));
  const html = bytes.toString("utf8");
  assert(Buffer.from(html, "utf8").equals(bytes), `${file}: not valid UTF-8`);

  // Exactly two inline, attribute-less scripts, both in <body>: the UNIT data and the engine.
  const bodyAt = html.indexOf("<body>");
  assert(bodyAt > 0 && html.indexOf("<head>") > 0, `${file}: <head>/<body> not found`);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert(scripts.length === 2 && (html.match(/<script\b/gi) ?? []).length === 2, `${file}: expected exactly 2 <script> tags`);
  for (const s of scripts) {
    assert(s[1] === "", `${file}: <script${s[1]}> has attributes`);
    assert(s.index > bodyAt, `${file}: script outside <body>`);
  }
  const [data, code] = scripts.map((s) => s[2]);
  assert(/^\s*window\.UNIT\s*=/.test(data), `${file}: first script is not "window.UNIT = …"`);
  if (engine === null) engine = code;
  assert(code === engine, `${file}: lesson engine differs from ${files[0]}`);

  const context = { window: {} };
  vm.runInNewContext(data, context, { timeout: 1000, filename: file });
  const unit = context.window.UNIT;
  assert(unit && typeof unit === "object", `${file}: window.UNIT missing`);
  assert(typeof unit.level === "string" && unit.level.startsWith("Intermediate"), `${file}: level "${unit.level}" is not Intermediate`);
  assert(Array.isArray(unit.words) && unit.words.length > 0, `${file}: no words`);
  for (const key of ["id", "short", "emoji", "title", "subtitle"]) assert(typeof unit[key] === "string" && unit[key], `${file}: UNIT.${key} missing`);

  const slug = file.replace(/^\d{2}-/, "").replace(/\.html$/, "");
  assert(!structuredSlugs.has(slug), `${file}: slug "${slug}" collides with a structured lesson`);
  copyFileSync(join(folder, file), join(DEST, file));
  const digest = sha256(bytes);
  assert(sha256(readFileSync(join(DEST, file))) === digest, `${file}: copy differs from the source`);

  lessons.push({
    slug,
    order: Number(file.slice(0, 2)),
    title: unit.title,
    topic: unit.short,
    emoji: unit.emoji,
    level: "Intermediate",
    levelLabel: unit.level,
    description: unit.subtitle.replaceAll("{n}", String(unit.words.length)),
    wordCount: unit.words.length,
    readingWords: countReadingWords(unit.article),
    sourceFile: basename(file),
    sourceSha256: digest,
  });
}
assert(new Set(lessons.map((l) => l.slug)).size === lessons.length, "duplicate slugs");
lessons.sort((a, b) => a.order - b.order);
writeFileSync(OUT, `${JSON.stringify(lessons, null, 2)}\n`);
console.log(`Imported ${lessons.length} interactive lessons (engine ${engine.length} chars, identical in all files) → ${DEST}`);
for (const l of lessons) console.log(`  ${String(l.order).padStart(2, "0")} ${l.slug.padEnd(24)} ${l.wordCount} words · ${l.readingWords} reading words · ${l.sourceSha256.slice(0, 12)}`);
