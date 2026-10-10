/**
 * Preservation checks — Property 2 of .kiro/specs/mobile-ui-exam-light-theme-fix (task 3): the dark
 * theme, desktop layouts and the light theme outside exams must stay as they were before the fix.
 * "Observation first": computed styles are captured on the UNFIXED code and compared later.
 *
 *   BASE_URL=http://localhost:3001 node e2e/preservation-checks.mjs --capture   → e2e/baseline/*.json
 *   BASE_URL=http://localhost:3000 node e2e/preservation-checks.mjs --compare   → e2e/report-preservation.json
 *   SEED=123 …          reproduce the fast-check sampled desktop widths
 *   FIXED_TIME=…        frozen clock (ISO); capture and compare must use the same value
 *   TOLERANCE=0.5       px allowed on width/height/x/y (sub-pixel noise); colours must match exactly
 *
 * Scenarios (snapshot = DOM path + computed colours, borders, shadows and box of every visible
 * element under the page content, or under .exam-shell on exams):
 *   dark-desktop  1440×900  Reading + Listening test, teacher and admin pages → full identity
 *   dark-phone    390×844   the same pages → colours identical for elements present in both (sizes may change)
 *   light-desktop 1440×900  teacher and admin dashboards → full identity
 * (The student dashboard is intentionally redesigned on this branch and not compared; see PAGES.)
 * Extra checks in --compare (no baseline): Reading test at sampled widths 1024–1920 keeps the panes side
 * by side and the header text-size control visible (3.5); on 390×844 inputs use 16px (3.12) and the
 * bottom tab bar has 5 tabs for every role (3.10).
 *
 * Determinism: frozen clock (page.clock), seeded Math.random, fonts loaded, CSS animations and
 * transitions off, prefers-reduced-motion, media play() rejected like a blocked autoplay, relative
 * times ("5s ago") pinned to "just now" before each snapshot.
 * In CI (.github/workflows/screens.yml) --capture runs against the merge-base with main and --compare
 * against HEAD, both on the same seeded database. Exit code 1 on any difference or failed check.
 */
import { chromium } from "playwright";
import { createRoleSessionCache } from "./role-session.mjs";

const ensureSignedIn = createRoleSessionCache();
import fc from "fast-check";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MODE = process.argv.includes("--capture") ? "capture" : process.argv.includes("--compare") ? "compare" : null;
if (!MODE) {
  console.error("Usage: node e2e/preservation-checks.mjs --capture | --compare");
  process.exit(2);
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const BASELINE = process.env.BASELINE_DIR ?? "e2e/baseline";
const REPORT = process.env.REPORT ?? "e2e/report-preservation.json";
const SEED = Number.parseInt(process.env.SEED ?? "", 10) || Math.floor(Math.random() * 2 ** 31);
const TOL = Number.isFinite(Number.parseFloat(process.env.TOLERANCE)) ? Number.parseFloat(process.env.TOLERANCE) : 0.5;
const FIXED_TIME = process.env.FIXED_TIME ?? `${new Date().toISOString().slice(0, 10)}T09:00:00Z`;

const USERS = {
  student: { email: "student1@averna.com", password: "student123" },
  teacher: { email: "teacher@averna.com", password: "teacher123" },
  admin: { email: "admin@averna.com", password: "admin123" },
};
const HOME = { student: "/dashboard", teacher: "/teacher/dashboard", admin: "/admin/dashboard" };

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const FREEZE_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

/** Snapshot columns: [path, ...PROPS]. Colours are compared exactly, the box within TOL. */
const PROPS = ["background-color", "color", "border-color", "box-shadow", "outline-color", "background-image", "width", "height", "x", "y"];
const COLOUR = [1, 2, 3, 4, 5, 6];
const GEOMETRY = [7, 8, 9, 10];

/**
 * A subset of PAGES in e2e/screens.mjs, plus the first Reading / Listening practice test.
 * The student dashboard is not compared: it is intentionally redesigned on this branch (URL-driven
 * tabs, only the active tab rendered), so its baseline from the merge-base no longer applies.
 */
const PAGES = {
  student: [
    ["reading-test", { exam: "reading" }],
    ["listening-test", { exam: "listening" }],
  ],
  teacher: [
    ["teacher-dashboard", "/teacher/dashboard"],
    ["teacher-reviews", "/teacher/reviews"],
    ["teacher-students", "/teacher/students"],
  ],
  admin: [
    ["admin-dashboard", "/admin/dashboard"],
    ["admin-placement", "/admin/placement"],
  ],
};

const SCENARIOS = [
  { id: "dark-desktop", theme: "dark", phone: false, compare: "full", pages: PAGES },
  { id: "dark-phone", theme: "dark", phone: true, compare: "colour", pages: PAGES },
  {
    id: "light-desktop",
    theme: "light",
    phone: false,
    compare: "full",
    // No student page: the dashboard is redesigned (see PAGES) and the light exam screens are
    // intentionally different, so PAGES.student[0] (now the Reading test) must not be compared here.
    pages: { student: [], teacher: [PAGES.teacher[0]], admin: [PAGES.admin[0]] },
  },
];

const problems = [];
const results = [];
const notes = [];
const problem = (label, message) => problems.push({ label, message });

// ---------------------------------------------------------------------------------------------
// Browser plumbing (same sign-in and storage flags as e2e/screens.mjs)
// ---------------------------------------------------------------------------------------------

async function signIn(context, { email, password }) {
  const page = await context.newPage();
  await page.goto(`${BASE}/auth/signin`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
}

async function newContext(browser, role, { theme, phone }) {
  const context = await browser.newContext({ ...(phone ? PHONE : DESKTOP), reducedMotion: "reduce" });
  await context.addInitScript((theme) => {
    localStorage.setItem("averna_theme", theme);
    localStorage.setItem("averna_onboarding_done_v1", "1");
    localStorage.setItem("averna_setup_done_v1", "1");
    localStorage.setItem("averna_seasonal", "0");
    sessionStorage.setItem("averna_pwa_dismissed", "1");
    // Seeded Math.random (mulberry32) so "random" tips and decorations repeat between runs.
    let s = 0x5eed;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Autoplay blocked the same way in every run (a playing track would move progress bars).
    HTMLMediaElement.prototype.play = function play() {
      return Promise.reject(new DOMException("play() blocked by preservation checks", "NotAllowedError"));
    };
  }, theme);
  await ensureSignedIn(context, BASE, role, USERS[role], signIn);
  await context.clock.install({ time: new Date(FIXED_TIME) });
  return context;
}

function watch(page, label) {
  page.on("pageerror", (e) => {
    if (/NotAllowedError/.test(e.message)) return; // autoplay noise
    notes.push({ label, message: `page error: ${e.message.slice(0, 200)}` });
  });
}

/** Opens the first Reading/Listening test from its library (or `href`); returns its path. */
async function openExam(page, skill, href) {
  if (!href) {
    await page.goto(`${BASE}/learning/${skill}`, { waitUntil: "networkidle", timeout: 60_000 });
    href = await page.evaluate((skill) => {
      const links = Array.from(document.querySelectorAll(`a[href^="/learning/${skill}/"]`)).map((a) => a.getAttribute("href"));
      return links.find((h) => h && !/\/result(\/|$|\?)/.test(h)) ?? null;
    }, skill);
    if (!href) throw new Error(`no ${skill} test link on /learning/${skill}`);
  }
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('.exam-shell nav[aria-label="Question navigator"]', { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return href;
}

/** Opens a page in the frozen state used for snapshots. Close with page.close() (skips the exam leave guard). */
async function load(context, target, label, pinnedHref) {
  const page = await context.newPage();
  watch(page, label);
  let path = typeof target === "string" ? target : null;
  if (path) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
  } else {
    path = await openExam(page, target.exam, pinnedHref);
  }
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(1_000);
  return { page, path };
}

// ---------------------------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------------------------

/** In-page: every visible element under the content root as [path, ...PROPS]. */
function snapshot() {
  // Pin relative times first ("updated 5s ago" → "just now"): they tick with the real clock between
  // capture and compare, and a wider pill would shift its neighbours. Runs synchronously right before
  // the measurements below, so no re-render can slip in between.
  const RELATIVE = /\bjust now\b|\b\d+\s?(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hours?)\s+ago\b/gi;
  const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = texts.nextNode(); t; t = texts.nextNode()) {
    if (/^(SCRIPT|STYLE)$/.test(t.parentNode?.nodeName ?? "")) continue;
    const pinned = t.nodeValue.replace(RELATIVE, "just now");
    if (pinned !== t.nodeValue) t.nodeValue = pinned;
  }
  for (const el of document.body.querySelectorAll("[aria-label]")) {
    const label = el.getAttribute("aria-label");
    const pinned = label.replace(RELATIVE, "just now");
    if (pinned !== label) el.setAttribute("aria-label", pinned);
  }
  const root = document.querySelector(".exam-shell") || document.querySelector('[class~="lg:pl-64"]') || document.body;
  const r1 = (v) => Math.round(v * 10) / 10;
  const out = [];
  // Path segments are tag[aria-label]:n, n counted among rendered siblings with the same key, so a new
  // hidden (display:none) or labelled element does not renumber its neighbours. Digits in labels are
  // masked ("Time remaining 59:58" → "Time remaining #:#"), and so are relative times, which tick with
  // the real clock between capture and compare ("Live, updated just now" / "updated 5s ago" → "updated #t").
  const walk = (el, prefix) => {
    const counts = new Map();
    for (const child of el.children) {
      const st = getComputedStyle(child);
      const contents = st.display === "contents";
      if (!contents && child.getClientRects().length === 0) continue;
      const label = child.getAttribute("aria-label");
      const masked = label?.replace(/\d+/g, "#").replace(/\bjust now\b|#\s?[a-z]* ago\b/gi, "#t");
      const key = child.tagName.toLowerCase() + (masked ? `[${masked.slice(0, 40)}]` : "");
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      const path = `${prefix}>${key}:${n}`;
      const r = child.getBoundingClientRect();
      if (!contents && r.width > 0 && r.height > 0 && st.visibility !== "hidden") {
        out.push([
          path,
          st.backgroundColor,
          st.color,
          st.borderColor,
          st.boxShadow,
          st.outlineColor,
          st.backgroundImage.slice(0, 300),
          r1(r.width),
          r1(r.height),
          r1(r.left + scrollX),
          r1(r.top + scrollY),
        ]);
      }
      walk(child, path);
    }
  };
  walk(root, root === document.body ? "body" : "root");
  return out;
}

const fileOf = (scenario, role, name) => join(BASELINE, `${scenario}-${role}-${name}.json`);

function diff(base, cur, mode) {
  const now = new Map(cur.map((e) => [e[0], e]));
  const was = new Set(base.map((e) => e[0]));
  const props = mode === "full" ? [...COLOUR, ...GEOMETRY] : COLOUR;
  const out = [];
  for (const b of base) {
    const c = now.get(b[0]);
    if (!c) {
      if (mode === "full") out.push({ path: b[0], change: "missing" });
      continue;
    }
    for (const i of props) {
      const same = GEOMETRY.includes(i) ? Math.abs(b[i] - c[i]) <= TOL : b[i] === c[i];
      if (!same) out.push({ path: b[0], prop: PROPS[i - 1], was: b[i], now: c[i] });
    }
  }
  if (mode === "full") for (const c of cur) if (!was.has(c[0])) out.push({ path: c[0], change: "extra" });
  return out;
}

async function runScenario(browser, sc) {
  for (const [role, pages] of Object.entries(sc.pages)) {
    // A role with nothing to snapshot and no extra check in this scenario needs no sign-in.
    const checks = MODE === "compare" && ((sc.id === "dark-desktop" && role === "student") || sc.id === "dark-phone");
    if (!pages.length && !checks) continue;
    const context = await newContext(browser, role, sc);
    try {
      for (const [name, target] of pages) {
        const label = `${sc.id}/${role}/${name}`;
        const file = fileOf(sc.id, role, name);
        try {
          const baseline = MODE === "compare" && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
          if (MODE === "compare" && !baseline) {
            problem(label, `no baseline ${file} (run --capture on the unfixed code first)`);
            continue;
          }
          const { page, path } = await load(context, target, label, baseline?.path);
          const elements = await page.evaluate(snapshot);
          await page.close();
          if (MODE === "capture") {
            writeFileSync(file, JSON.stringify({ label, path, fixedTime: FIXED_TIME, props: PROPS, count: elements.length, elements }));
            results.push({ label, path, elements: elements.length });
            console.log(`${label}: ${elements.length} elements captured`);
          } else {
            const d = diff(baseline.elements, elements, sc.compare);
            results.push({ label, path, compare: sc.compare, baseline: baseline.count, current: elements.length, diffs: d.length, examples: d.slice(0, 25) });
            if (d.length) problem(label, `${d.length} difference(s) from the baseline (${sc.compare}), e.g. ${JSON.stringify(d[0])}`);
            console.log(`${label}: ${d.length} difference(s)`);
          }
        } catch (e) {
          problem(label, `failed: ${String(e?.message ?? e).split("\n")[0]}`);
        }
      }
      if (MODE === "compare" && sc.id === "dark-desktop" && role === "student") await desktopCheck(context);
      if (MODE === "compare" && sc.id === "dark-phone") await phoneChecks(context, role);
    } finally {
      await context.close();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Checks without a baseline (--compare only)
// ---------------------------------------------------------------------------------------------

/** 3.5: at sampled widths 1024–1920 the Reading panes sit side by side and the text-size control shows. */
async function desktopCheck(context) {
  const widths = fc.sample(fc.integer({ min: 1024, max: 1920 }), { numRuns: 3, seed: SEED });
  const page = await context.newPage();
  watch(page, "desktop/reading");
  try {
    await openExam(page, "reading");
    for (const w of widths) {
      const label = `desktop/reading/${w}px`;
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const vis = (el) => {
          if (!el || getComputedStyle(el).display === "none") return null;
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0 ? { x: b.left, y: b.top, right: b.right, w: b.width } : null;
        };
        const root = document.querySelector(".exam-shell");
        const sep = root.querySelector('[role="separator"]');
        const group = root.querySelector('header [role="group"][aria-label="Text size"]');
        return {
          sep: vis(sep),
          left: sep && vis(sep.previousElementSibling),
          right: sep && vis(sep.nextElementSibling),
          textSize: vis(group),
          vw: innerWidth,
        };
      });
      if (!r.sep) problem(label, "no visible pane divider");
      if (!r.left || !r.right) problem(label, `only ${[r.left, r.right].filter(Boolean).length} pane(s) visible (expected 2 side by side)`);
      else if (r.left.right > r.right.x + 1 || Math.abs(r.left.y - r.right.y) > 1) {
        problem(label, `panes are not side by side: left ${JSON.stringify(r.left)}, right ${JSON.stringify(r.right)}`);
      }
      if (!r.textSize) problem(label, "header text-size control is not visible");
      else if (r.textSize.right > r.vw + 0.5) problem(label, `text-size control ends at ${r.textSize.right}px outside the ${r.vw}px window`);
      results.push({ label, check: "3.5 desktop panes + text size", ok: !problems.some((p) => p.label === label) });
    }
  } catch (e) {
    problem("desktop/reading", `check crashed: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

/** 3.10: five bottom tabs for every role; 3.12: inputs use 16px on a phone (student pages + a Reading test). */
async function phoneChecks(context, role) {
  const visibleCount = (page, selector) =>
    page.evaluate((selector) => {
      const vis = (el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0;
      const bar = Array.from(document.querySelectorAll("nav")).find((n) => {
        const b = n.getBoundingClientRect();
        return getComputedStyle(n).position === "fixed" && b.height > 0 && Math.abs(b.bottom - innerHeight) <= 1;
      });
      if (selector === "tabs") return bar ? Array.from(bar.querySelectorAll("a[href]")).filter(vis).length : null;
      const fields = Array.from(document.querySelectorAll(selector)).filter(vis);
      return fields.map((f) => ({ name: f.getAttribute("placeholder") || f.getAttribute("name") || f.tagName.toLowerCase(), fontSize: getComputedStyle(f).fontSize }));
    }, selector);

  const label = `phone/${role}`;
  let page = await context.newPage();
  watch(page, label);
  try {
    await page.goto(`${BASE}${HOME[role]}`, { waitUntil: "networkidle", timeout: 60_000 });
    const tabs = await visibleCount(page, "tabs");
    if (tabs !== 5) problem(`${label}/tab bar`, tabs == null ? "no bottom tab bar" : `${tabs} tabs (expected 5)`);
    results.push({ label: `${label}/tab bar`, check: "3.10 five tabs", tabs });
    if (role !== "student") return;

    const FIELDS = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="color"]), select, textarea';
    let seen = 0;
    for (const target of ["/messages", "/settings", "/profile", { exam: "reading" }]) {
      const where = typeof target === "string" ? target : "/reading-test";
      if (typeof target === "string") await page.goto(`${BASE}${target}`, { waitUntil: "networkidle", timeout: 60_000 });
      else {
        await page.close();
        page = await context.newPage();
        watch(page, label);
        await openExam(page, "reading");
      }
      const fields = await visibleCount(page, FIELDS);
      seen += fields.length;
      const bad = fields.filter((f) => f.fontSize !== "16px");
      if (bad.length) problem(`${label}${where}`, `${bad.length} field(s) not 16px, e.g. ${bad.slice(0, 3).map((f) => `“${f.name}” ${f.fontSize}`).join("; ")}`);
      if (!fields.length) notes.push({ label: `${label}${where}`, message: "no text fields on this page" });
      results.push({ label: `${label}${where}`, check: "3.12 16px fields", fields: fields.length, bad: bad.length });
    }
    if (!seen) problem(`${label}/fields`, "no text fields found on any checked page");
  } catch (e) {
    problem(label, `check crashed: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------------------------

mkdirSync(BASELINE, { recursive: true });
const browser = await chromium.launch();
try {
  for (const sc of SCENARIOS) await runScenario(browser, sc);
} finally {
  await browser.close();
}

const summary = { mode: MODE, baseUrl: BASE, seed: SEED, fixedTime: FIXED_TIME, tolerance: TOL, problems, notes, results };
const out = MODE === "capture" ? join(BASELINE, "_capture.json") : REPORT;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`Report: ${out} (seed ${SEED}, clock ${FIXED_TIME})`);
for (const n of notes) console.log(`note ${n.label}: ${n.message}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.map((p) => `${p.label}: ${p.message}`).join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(MODE === "capture" ? "Baseline captured." : "No differences: Property 2 holds for the checked scenarios.");
}
