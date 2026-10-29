/**
 * Synthetic Volume 10 source files for the importer tests: the same classes
 * and script literals as the supplied papers, with made-up words instead of
 * their texts. No passage, key or transcript of a supplied paper is used here.
 */

import { gzipSync } from "zlib";
import { Mp3Assembler, silentFrame, type Mp3Format } from "../../../lib/ielts/audio/mp3";
import { encodeUtf8SevenBit } from "../../../lib/cdi-import/packed-audio";

const WORDS = ["amber", "basalt", "cobalt", "delta", "ember", "fjord", "garnet", "harbour", "indigo", "juniper", "kelp", "lagoon", "meadow", "nectar", "orchid", "pebble", "quartz", "reef", "saffron", "tundra", "umber", "valley", "willow", "yarrow", "zephyr"];

/** Tiny deterministic generator (tests must not depend on Math.random). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

function sentence(r: () => number, n = 12): string {
  const w = Array.from({ length: n }, () => pick(r, WORDS));
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  return `${w.join(" ")}.`;
}

export interface ReadingFixture {
  html: string;
  key: Record<string, string | string[]>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A Reading source with all seven group kinds (and the "A–J without I" word box of test 2). */
export function readingSource(seed = 1, opts: { dropQuestion?: number; noKey?: boolean; extraText?: string } = {}): ReadingFixture {
  const r = rng(seed);
  const key: Record<string, string | string[]> = {};
  const gapWords: Record<number, string[]> = {};
  for (const n of [9, 10, 11, 12, 13, 33, 34, 35, 36]) gapWords[n] = n % 2 ? [`${pick(r, WORDS)}stone`] : [`${pick(r, WORDS)}field`, "field"];
  const para = (label: string | null, extra: string) => `<p>${label ? `<span class="letter">${label}</span>` : ""}${esc(sentence(r, 40))} ${extra} ${esc(sentence(r, 40))}</p>`;
  const passages = [
    ["A", "B", "C", "D", "E", "F"].map((l, i) => para(l, i === 0 ? [9, 10, 11, 12, 13].map((n) => gapWords[n][0]).join(" ") : "")),
    ["1", "2", "3", "4", "5"].map((l) => para(l, "")),
    ["A", "B", "C", "D", "E"].map((l, i) => para(l, i === 0 ? [33, 34, 35, 36].map((n) => gapWords[n][0]).join(" ") + (opts.extraText ?? "") : "")),
  ];
  // Passage 1
  const tf = ["TRUE", "FALSE", "NOT GIVEN", "TRUE", "FALSE"];
  for (let n = 1; n <= 5; n++) key[n] = tf[n - 1];
  for (const [n, k] of [[6, "B"], [7, "A"], [8, "B"]] as const) key[n] = k;
  for (const n of [9, 10, 11, 12, 13]) key[n] = gapWords[n].length > 1 ? gapWords[n] : gapWords[n][0];
  // Passage 2
  for (const [n, k] of [[14, "iii"], [15, "i"], [16, "v"], [17, "ii"]] as const) key[n] = k;
  for (const [n, k] of [[18, "C"], [19, "A"], [20, "D"]] as const) key[n] = k;
  for (const [n, k] of [[21, "A"], [22, "J"], [23, "C"], [24, "E"], [25, "G"], [26, "H"]] as const) key[n] = k;
  // Passage 3
  const yn = ["YES", "NO", "NOT GIVEN", "NO"];
  for (let n = 27; n <= 30; n++) key[n] = yn[n - 27];
  key[31] = "B";
  key[32] = "D";
  for (const n of [33, 34, 35, 36]) key[n] = gapWords[n].length > 1 ? gapWords[n] : gapWords[n][0];
  for (const [n, k] of [[37, "C"], [38, "A"], [39, "D"], [40, "B"]] as const) key[n] = k;
  if (opts.dropQuestion) delete key[opts.dropQuestion];

  const q = (n: number, text: string) =>
    `<div class="question" data-q="${n}"><div class="q-head"><span class="q-number">${n}</span><span class="q-prompt">${esc(text)}</span><button type="button" class="flag-btn" data-flag="${n}">☆ Review</button></div><div class="options"></div></div>`;
  const gap = (n: number, words: number) =>
    `<span data-q="${n}" class="inline-answer"><strong>${n}</strong><input type="text" class="answer-input" id="q${n}" data-maxwords="${words}"><button type="button" class="flag-btn" data-flag="${n}">☆ Review</button></span>`;
  const mcq = (n: number) => {
    const choices = JSON.stringify([sentence(r, 5), sentence(r, 5), sentence(r, 5), sentence(r, 5)]).replace(/"/g, "&quot;");
    return `<div class="question" data-q="${n}"><div class="q-head"><span class="q-number">${n}</span><span class="q-prompt">${esc(sentence(r, 8))}</span></div><div class="options" data-choices="${choices}"></div></div>`;
  };
  const people = { 6: sentence(r, 6), 7: sentence(r, 6), 8: sentence(r, 6) };
  const endings = { 37: sentence(r, 5), 38: sentence(r, 5), 39: sentence(r, 5), 40: sentence(r, 5) };
  const groups1 = `
    <section class="question-group"><h3>Questions 1–5</h3><p class="instruction">Do the following statements agree with the information given in Reading Passage 1? Choose <strong>TRUE</strong>, <strong>FALSE</strong> or <strong>NOT GIVEN</strong>.</p>
      ${[1, 2, 3, 4, 5].map((n) => q(n, sentence(r, 9))).join("")}</section>
    <section class="question-group"><h3>Questions 6–8</h3><p class="instruction">Match each statement with the correct person, <strong>A–C</strong>.</p><p>NB You may use any letter more than once.</p>
      <div class="people-legend"><strong>List of People</strong><div><span>Ada Lovelace <b>A</b></span><span>Ibn Sina <b>B</b></span><span>Mary Seacole <b>C</b></span></div></div>
      <div class="matching-grid-wrap"><table class="matching-grid"><thead><tr><th>Statement</th><th>A</th><th>B</th><th>C</th></tr></thead><tbody id="peopleGrid"></tbody></table></div></section>
    <section class="question-group"><h3>Questions 9–13</h3><p class="instruction">Complete the summary below. Write <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p><h4>${esc(sentence(r, 3))}</h4>
      <div class="summary-card"><p>${[9, 10, 11, 12, 13].map((n) => `${esc(sentence(r, 6))} ${gap(n, 2)}`).join(" ")}</p></div></section>`;
  const groups2 = `
    <section class="question-group"><h3>Questions 14–17</h3><p class="instruction">Reading Passage 2 has five paragraphs, <strong>1–5</strong>. Choose the correct heading for each paragraph from the list below.</p><h4>List of Headings</h4><div id="headingBank" class="mh-headings-bank"></div>
      <div class="heading-question-list">${[14, 15, 16, 17].map((n, i) => `<div class="q-head" data-q="${n}"><button type="button" class="heading-jump q-number" data-heading-nav="${n}">${n}</button><span class="q-prompt">Paragraph ${i + 1}</span></div>`).join("")}</div></section>
    <section class="question-group"><h3>Questions 18–20</h3><p class="instruction">Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.</p>${[18, 19, 20].map(mcq).join("")}</section>
    <section class="question-group"><h3>Questions 21–26</h3><p class="instruction">Complete the summary using the list of words, <strong>A–J</strong>, below.</p>
      <div class="dd-summary-card"><p class="dd-summary-text">${[21, 22, 23, 24, 25, 26].map((n) => `${esc(sentence(r, 6))} <span class="dd-inline-slot" data-q="${n}"><span class="dd-q-badge">${n}</span></span>`).join(" ")}</p></div>
      <div class="dd-options-bank"></div></section>`;
  const groups3 = `
    <section class="question-group"><h3>Questions 27–30</h3><p class="instruction">Do the following statements agree with the claims of the writer in Reading Passage 3? Choose <strong>YES</strong>, <strong>NO</strong> or <strong>NOT GIVEN</strong>.</p>${[27, 28, 29, 30].map((n) => q(n, sentence(r, 9))).join("")}</section>
    <section class="question-group choose-two" data-q="31"><h3>Questions 31–32</h3><p class="instruction">Which <strong>TWO</strong> statements are made by the writer? Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</p>
      <div class="two-review"><span class="q-number">31</span><span class="q-number" data-q="32">32</span></div>
      <div class="options" id="twoChoiceOptions">${["A", "B", "C", "D", "E"].map((k) => `<label class="option multi-choice-option"><input type="checkbox" name="q31_32" value="${k}"><span><strong>${k}.</strong> ${esc(sentence(r, 5))}</span></label>`).join("")}</div></section>
    <section class="question-group"><h3>Questions 33–36</h3><p class="instruction">Complete the sentences below. Write <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>
      ${[33, 34, 35, 36].map((n) => `<div class="question sentence-question">${esc(sentence(r, 7))} ${gap(n, 2)}</div>`).join("")}</section>
    <section class="question-group"><h3>Questions 37–40</h3><p class="instruction">Complete each sentence with the correct ending, <strong>A–E</strong>, below.</p>
      <div class="people-legend opinion-legend"><strong>List of Endings</strong><div>${["A", "B", "C", "D", "E"].map((k) => `<span>${esc(sentence(r, 4))} <b>${k}</b></span>`).join("")}</div></div>
      <div class="matching-grid-wrap"><table class="matching-grid ending-grid"><thead><tr><th>Sentence</th></tr></thead><tbody id="endingGrid"></tbody></table></div></section>`;
  const keyText = JSON.stringify(key).replace(/"/g, "'");
  const html = `<!DOCTYPE html><html><head><title>Volume 10 Reading</title><style>.timer{}</style></head><body>
<header class="topbar"><div class="timer">60:00</div><a class="telegram" href="https://t.me/IELTS_Volume">@IELTS_Volume</a><button class="check-btn">Check Answers</button></header>
<section class="passage-panel">${passages.map((ps, i) => `<div class="passage-content part-content" id="passage${i + 1}"><h2>${esc(sentence(r, 4))}</h2>${ps.join("")}</div>`).join("")}</section>
<section class="questions-panel">
<div class="questions-content part-content" id="questions1">${groups1}</div>
<div class="questions-content part-content" id="questions2">${groups2}</div>
<div class="questions-content part-content" id="questions3">${groups3}</div>
</section>
<div class="note-modal">Notes</div>
<script>
${opts.noKey ? "" : `const correctAnswers = ${keyText};`}
const headingOptions = {'i':'${sentence(r, 4)}','ii':'${sentence(r, 4)}','iii':'${sentence(r, 4)}','iv':'${sentence(r, 4)}','v':'${sentence(r, 4)}','vi':'${sentence(r, 4)}'};
const ddOptions = {A:'${pick(r, WORDS)}',B:'${pick(r, WORDS)}',C:'${pick(r, WORDS)}',D:'${pick(r, WORDS)}',E:'${pick(r, WORDS)}',F:'${pick(r, WORDS)}',G:'${pick(r, WORDS)}',H:'${pick(r, WORDS)}',J:'${pick(r, WORDS)}'};
function buildMatchingGrid(){ const people = ${JSON.stringify(people)}; const endings = ${JSON.stringify(endings)}; return [people, endings]; }
globalThis.__executed = true;
</script></body></html>`;
  return { html, key };
}

export const SILENT_FORMAT: Mp3Format = { version: 1, sampleRate: 48000, sampleRateIndex: 1, channels: 2, channelMode: 1, samplesPerFrame: 1152, sideInfoLength: 32, flags: 0 };

/** About `seconds` of silence as an MP3 (Info header + silent frames). */
export function silentMp3(seconds = 5): Uint8Array {
  const asm = new Mp3Assembler(SILENT_FORMAT);
  const frames = Array.from({ length: Math.round((seconds * 1000) / 24) }, () => silentFrame(SILENT_FORMAT, 1));
  asm.addClip({ format: SILENT_FORMAT, frames });
  return asm.finish().bytes;
}

/** Smallest valid PNG (1×1). */
export const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

export interface ListeningFixture {
  html: string;
  key: Record<string, string | string[]>;
  mp3: Uint8Array;
}

/** A Listening source with a packed whole recording, answer windows, a shared "13 14" marker, a map image and a Telegram link. */
export function listeningSource(seed = 1, opts: { packed?: boolean; corruptLength?: boolean; badWindow?: boolean } = {}): ListeningFixture {
  const r = rng(seed);
  const mp3 = silentMp3(5);
  const key: Record<string, string | string[]> = {};
  const word = () => pick(r, WORDS);
  for (let n = 1; n <= 10; n++) key[n] = n === 3 ? ["8", "eight"] : word();
  for (let n = 11; n <= 15; n++) key[n] = pick(r, ["A", "B", "C"]);
  for (let n = 16; n <= 20; n++) key[n] = ["A", "B", "C", "D", "E"][n - 16];
  for (let n = 21; n <= 24; n++) key[n] = ["B", "A", "D", "C"][n - 21];
  key[25] = "A";
  key[26] = "C";
  for (let n = 27; n <= 30; n++) key[n] = pick(r, ["A", "B", "C"]);
  for (let n = 31; n <= 40; n++) key[n] = word();
  const rules = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), { maxWords: 1, maxNumbers: 1 }]));
  const noteLines = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((n) => `<p class="note-line" id="question-${n}" data-question="${n}">${esc(sentence(r, 5))} <strong class="q-badge">${n}</strong><input type="text" class="answer-input" id="q${n}" data-question="${n}"><span class="answer-feedback" id="feedback-${n}"></span></p>`)
      .join("");
  const radios = (n: number) =>
    `<div class="short-question" id="question-${n}" data-question="${n}"><p>${esc(sentence(r, 7))} <strong class="q-badge">${n}</strong></p>${["A", "B", "C"].map((k) => `<div class="multi-choice-option"><label><input type="radio" name="q${n}" value="${k}" data-question="${n}"><span class="option-code">${k}</span><span>${esc(sentence(r, 3))}</span></label></div>`).join("")}</div>`;
  const map = `<div class="listening-map-wrap"><div class="listening-map-card"><img class="store-plan-image" alt="Map of a park" src="data:image/png;base64,${PNG_1X1.toString("base64")}"></div>
    <table class="lmap-matrix"><thead><tr><th>Place</th>${["A", "B", "C", "D", "E"].map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${[16, 17, 18, 19, 20].map((n) => `<tr id="question-${n}" data-question="${n}"><th>${esc(word())} <strong class="q-badge">${n}</strong></th>${["A", "B", "C", "D", "E"].map((k) => `<td><label class="lmap-cell" data-question="${n}" data-value="${k}"><input type="radio" name="q${n}" value="${k}" data-question="${n}"></label></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const ldm = `<div class="listening-drag-matching" data-group="g" data-reuse="false"><div class="ldm-left">${[21, 22, 23, 24].map((n) => `<div class="ldm-row" id="question-${n}" data-question="${n}"><span class="ldm-qtext"><strong class="q-badge">${n}</strong> ${esc(word())}</span><div class="slot-wrap"><button type="button" class="ldm-slot" data-question="${n}">Drop A–E here</button></div></div>`).join("")}</div>
    <div class="ldm-right">${["A", "B", "C", "D", "E"].map((k) => `<button type="button" class="ldm-option" data-code="${k}"><span class="ldm-code">${k}</span><span class="ldm-text">${esc(sentence(r, 3))}</span></button>`).join("")}</div></div>`;
  const multi = `<div class="multi-select-group" id="question-25" data-question="25"><h3>Which TWO things does the speaker mention?</h3>${["A", "B", "C", "D", "E"].map((k) => `<div class="multi-choice-option"><label><input type="checkbox" name="q25_26" value="${k}" data-question="25"><span class="option-code">${k}</span><span>${esc(sentence(r, 3))}</span></label></div>`).join("")}</div>`;
  const section = (no: number, topic: string, body: string) =>
    `<div class="test-section" id="section${no}" data-section="${no}"><div class="section-banner"><p><strong>Section ${no}</strong> — ${esc(topic)}</p><p>Listen and answer questions ${no * 10 - 9}–${no * 10}.</p></div>${body}</div>`;
  const card = (range: string, instruction: string, body: string) => `<section class="question-card"><h2>Questions ${range}</h2><p class="instruction">${instruction}</p>${body}</section>`;
  const topics = [sentence(r, 3), sentence(r, 3), sentence(r, 3), sentence(r, 3)].map((t) => t.replace(/\.$/, ""));
  const questions = [
    section(1, topics[0], card("1–10", "Complete the notes below. Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.", `<h3>${esc(topics[0])}</h3>${noteLines(1, 10)}`)),
    section(2, topics[1], card("11–15", "Choose the correct letter, <strong>A, B or C</strong>.", [11, 12, 13, 14, 15].map(radios).join("")) + card("16–20", "Label the map below. Choose the correct letter, <strong>A–E</strong>, next to questions 16–20.", map)),
    section(3, topics[2], card("21–24", "What does the speaker say about each of the following? Choose <strong>FOUR</strong> answers, <strong>A–E</strong>.", ldm) + card("25–26", "Choose <strong>TWO</strong> letters, <strong>A–E</strong>.", multi) + card("27–30", "Choose the correct letter, <strong>A, B or C</strong>.", [27, 28, 29, 30].map(radios).join(""))),
    section(4, topics[3], card("31–40", "Complete the notes below. Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.", noteLines(31, 40))),
  ].join("");
  // Transcript: one reply per question with its marker; questions 13 and 14 share one marker.
  const line = (speaker: string, before: string, n: number[], hit: string, after: string) =>
    `<p class="transcript-paragraph"><span class="speaker">${speaker}:</span> ${esc(before)} <mark class="transcript-answer-hit" data-questions="${n.join(" ")}">${esc(hit)}</mark><sup class="transcript-q-tag">${n.join(" ")}</sup> ${esc(after)}</p>`;
  const transcript = [1, 2, 3, 4]
    .map((p) => {
      const nums = Array.from({ length: 10 }, (_, i) => p * 10 - 9 + i);
      const replies: string[] = [];
      for (let i = 0; i < nums.length; i++) {
        const n = nums[i];
        if (n === 14) continue;
        const ns = n === 13 ? [13, 14] : [n];
        replies.push(line(i % 2 ? "MAN" : "WOMAN", sentence(r, 6), ns, String(Array.isArray(key[n]) ? key[n][0] : key[n]), sentence(r, 6)));
        replies.push(`<div class="transcript-audio-links"><button type="button" class="audio-evidence-button" data-questions="${ns.join(" ")}" data-audio-start="${((n - 1) * 0.12).toFixed(2)}" data-audio-end="${opts.badWindow && n === 40 ? "999.00" : ((n - 1) * 0.12 + 0.1).toFixed(2)}">▶ Q${n}</button></div>`);
      }
      return `<div class="transcript-section" data-section="${p}"><h2>${esc(topics[p - 1])}</h2>${replies.join("")}</div>`;
    })
    .join("");
  const gz = gzipSync(Buffer.from(mp3), { level: 9 });
  const packed = encodeUtf8SevenBit(new Uint8Array(gz));
  const audio = opts.packed === false
    ? `<audio id="mainAudio" preload="auto" src="data:audio/mpeg;base64,${Buffer.from(mp3).toString("base64")}"></audio>`
    : `<audio id="fullAudio" preload="auto"></audio><script id="embeddedAudioData" type="application/octet-stream" data-original-bytes="${mp3.length + (opts.corruptLength ? 1 : 0)}" data-compressed-bytes="${gz.length}" data-encoding="utf8-seven-bit">${packed}</script>`;
  const keyText = JSON.stringify(key);
  const html = `<!DOCTYPE html><html><head><title>Volume 10 Listening</title></head><body>
<header class="fixed-header"><div class="timer-display">30:00</div><a class="telegram-pin" href="https://t.me/IELTS_Volume">@IELTS_Volume</a></header>
${audio}
<section id="questionsPanel" class="questions-panel">${questions}</section>
<aside id="transcriptPanel" class="transcript-panel"><div class="transcript-scroll">${transcript}</div></aside>
<script>
const correctAnswers = ${keyText};
const textAnswerRules = ${JSON.stringify(rules)};
const multiPickGroups = [{"name":"q25_26","questionIds":[25,26],"maxSelections":2,"correctAnswers":["A","C"]}];
globalThis.__executed = true;
</script></body></html>`;
  return { html, key, mp3 };
}
