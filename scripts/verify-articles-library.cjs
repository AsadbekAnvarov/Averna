#!/usr/bin/env node
// Read-only release guard: never publish a silently truncated Articles library.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const structured = read('lib/articles/catalog.json');
const interactive = read('lib/articles/interactive.json');
assert(structured.length >= 11, 'Structured Articles are missing');
assert(interactive.length >= 13, 'Interactive Articles are missing');
const slugs = new Set();
for (const lesson of [...structured, ...interactive]) {
  assert(lesson.slug && !slugs.has(lesson.slug), `Missing/duplicate slug: ${lesson.slug}`);
  slugs.add(lesson.slug);
}
for (const lesson of interactive) {
  assert(/^\d{2}-[a-z-]+\.html$/.test(lesson.sourceFile), 'Unsafe article filename');
  const bytes = fs.readFileSync(path.join(root, 'content/articles/intermediate', lesson.sourceFile));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), lesson.sourceSha256,
    `Article source changed: ${lesson.slug}. Re-import and review the source deliberately.`);
}
const counts = {};
for (const lesson of [...structured, ...interactive]) counts[lesson.level] = (counts[lesson.level] || 0) + 1;
assert(counts['Pre-intermediate'] >= 10 && counts.Intermediate >= 14, 'Articles level coverage regressed');
console.log(`Articles release guard passed: ${slugs.size} lessons (${counts['Pre-intermediate']} Pre-intermediate, ${counts.Intermediate} Intermediate); ${interactive.length} original HTML checksums verified.`);
