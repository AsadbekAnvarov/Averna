/**
 * Density and comfort check for the compact layout: how much fits on a screen, and that it stays
 * comfortable to use. Measures each page on a phone and a desktop in the dark theme, then compares
 * HEAD with a baseline captured on the parent branch.
 *
 *   BASE_URL=http://localhost:3001 node e2e/density.mjs --capture e2e/density-base.json
 *   BASE_URL=http://localhost:3000 node e2e/density.mjs --compare e2e/density-base.json   → e2e/report-density.json
 *   REPORT=…   other report path
 *
 * Per page and device, after one scroll-through with animations frozen:
 *   screens     document height / viewport height (2 decimals)
 *   aboveFold   visible headings and cards (h1, h2, h3, [class*=card]) starting above the fold
 *   minFont     smallest computed font-size of visible text (aria-hidden and sr-only text ignored)
 *   small       phone only: visible a, button, [role=tab], input, select, summary under 44px high or
 *               24px wide (links inside running text and anything inside an iframe are not counted)
 *   uneven      desktop only: every .dash-row (components/ui/dash-row.tsx); its visible direct children
 *               are grouped into visual rows by their top (±2px), and a visual row whose cells differ
 *               in height by more than 2px is listed (row selector path, y, heights)
 *
 * --compare prints a table and fails (exit 1) only on COMFORT problems:
 *   - more than 2 extra small targets on a phone page,
 *   - smallest text below 11px where the base was at 11px or more,
 *   - a page more than 15% longer (screens),
 *   - any uneven dashboard row on HEAD (absolute check; needs no base).
 * Denser pages are the goal, so shorter pages and more content above the fold never fail.
 * A page that is missing (404) on both sides is skipped. Runs in CI (.github/workflows/screens.yml)
 * against the same seeded database as the preservation checks.
 */
import { chromium } from "playwright";
import { createRoleSessionCache } from "./role-session.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ensureSignedIn = createRoleSessionCache();

const argAfter = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MODE = process.argv.includes("--capture") ? "capture" : process.argv.includes("--compare") ? "compare" : null;
const FILE = MODE ? argAfter(`--${MODE}`) : undefined;
if (!MODE || !FILE || FILE.startsWith("--")) {
  console.error("Usage: node e2e/density.mjs --capture <file> | --compare <baseFile>");
  process.exit(2);
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REPORT = process.env.REPORT ?? "e2e/report-density.json";

const USERS = {
  student: { email: "student1@averna.com", password: "student123" },
  teacher: { email: "teacher@averna.com", password: "teacher123" },
  admin: { email: "admin@averna.com", password: "admin123" },
};

const PAGES = {
  student: [
    // All five dashboard tabs (Today, Learn, Progress, Class, Play).
    "/dashboard",
    "/dashboard?tab=learn",
    "/dashboard?tab=progress",
    "/dashboard?tab=class",
    "/dashboard?tab=fun",
    "/progress",
    // The AI Coach hub (elegance roadmap, idea 9); "new on head" until the base has it.
    "/coach",
    "/learning",
    "/homework",
    "/article",
    "/rankings",
    "/settings",
    "/messages",
  ],
  teacher: ["/teacher/dashboard", "/teacher/students", "/teacher/homework"],
  admin: ["/admin/dashboard", "/admin/groups"],
};

const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const FREEZE_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

/** Comfort limits (see the header). evenRowTop / evenRowHeight in px. */
const LIMITS = { extraSmallTargets: 2, minFont: 11, screensGrowth: 0.15, evenRowTop: 2, evenRowHeight: 2 };

const notes = [];

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

async function newContext(browser, role, device) {
  const context = await browser.newContext({ ...DEVICES[device], reducedMotion: "reduce" });
  await context.addInitScript(() => {
    // Init scripts run in every frame; the interactive lesson's sandboxed frame has no storage access.
    if (window !== window.top) return;
    localStorage.setItem("averna_theme", "dark");
    localStorage.setItem("averna_onboarding_done_v1", "1");
    localStorage.setItem("averna_setup_done_v1", "1");
    localStorage.setItem("averna_seasonal", "0");
    sessionStorage.setItem("averna_pwa_dismissed", "1");
  });
  await ensureSignedIn(context, BASE, role, USERS[role], signIn);
  return context;
}

// ---------------------------------------------------------------------------------------------
// Measurement (in the page)
// ---------------------------------------------------------------------------------------------

function measure({ phone, tolerance }) {
  const vw = innerWidth;
  const vh = innerHeight;
  const opacityZero = new Map();
  const transparent = (el) => {
    if (!el || el === document.documentElement) return false;
    if (opacityZero.has(el)) return opacityZero.get(el);
    const v = getComputedStyle(el).opacity === "0" || transparent(el.parentElement);
    opacityZero.set(el, v);
    return v;
  };
  const shown = (el) => {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || transparent(el)) return null;
    const r = el.getBoundingClientRect();
    // sr-only text is clipped to 1×1 px.
    if (r.width <= 1 || r.height <= 1) return null;
    return r;
  };
  const silent = (el) => !!el.closest('[aria-hidden="true"], .sr-only, [hidden]');
  const describe = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("name") || "").trim();
    return `${el.tagName.toLowerCase()} “${text.replace(/\s+/g, " ").slice(0, 30)}”`;
  };

  const screens = Math.round((document.documentElement.scrollHeight / vh) * 100) / 100;

  let aboveFold = 0;
  for (const el of document.querySelectorAll('h1, h2, h3, [class*="card"]')) {
    if (silent(el)) continue;
    const r = shown(el);
    if (r && r.top < vh) aboveFold++;
  }

  let minFont = null;
  let minFontSample = null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.nodeValue || !t.nodeValue.trim()) continue;
    const el = t.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|svg|title)$/i.test(el.tagName) || silent(el) || !shown(el)) continue;
    const fs = Number.parseFloat(getComputedStyle(el).fontSize);
    if (Number.isFinite(fs) && (minFont === null || fs < minFont)) {
      minFont = fs;
      minFontSample = `${el.tagName.toLowerCase()} “${t.nodeValue.trim().slice(0, 30)}”`;
    }
  }

  let small = null;
  const smallExamples = [];
  if (phone) {
    small = 0;
    for (const el of document.querySelectorAll('a, button, [role="tab"], input, select, summary')) {
      if (el.matches('input[type="hidden"]') || silent(el)) continue;
      const r = shown(el);
      if (!r || r.right <= 0 || r.left >= vw) continue; // off-canvas (closed drawers)
      // Links inside running text (a sentence in a paragraph or list item) are sized by the text.
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
        const block = el.closest("p, li");
        if (block && (block.textContent || "").trim().length > (el.textContent || "").trim().length) continue;
      }
      if (r.height < 44 || r.width < 24) {
        small++;
        if (smallExamples.length < 6) smallExamples.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
  }

  // Even rows (desktop): the cells of one visual row of a .dash-row must be equally tall.
  let uneven = null;
  if (!phone) {
    uneven = [];
    const pathOf = (el) => {
      const parts = [];
      for (let n = el; n && n !== document.body && parts.length < 5; n = n.parentElement) {
        if (n.id) {
          parts.unshift(`#${n.id}`);
          break;
        }
        // First plain class name (skip Tailwind variants such as md:gap-4 or w-1/2).
        const cls = [...n.classList].find((c) => /^[a-z][\w-]*$/i.test(c));
        const nth = n.parentElement ? [...n.parentElement.children].indexOf(n) + 1 : 1;
        parts.unshift(`${n.tagName.toLowerCase()}${cls ? `.${cls}` : ""}:nth-child(${nth})`);
      }
      return parts.join(" > ");
    };
    for (const row of document.querySelectorAll(".dash-row")) {
      if (silent(row) || !shown(row)) continue;
      const cells = [...row.children]
        .map((c) => shown(c))
        .filter(Boolean)
        .sort((a, b) => a.top - b.top);
      const lines = [];
      for (const r of cells) {
        const line = lines.find((l) => Math.abs(l.top - r.top) <= tolerance.top);
        if (line) line.heights.push(r.height);
        else lines.push({ top: r.top, heights: [r.height] });
      }
      for (const l of lines) {
        if (l.heights.length < 2) continue;
        if (Math.max(...l.heights) - Math.min(...l.heights) > tolerance.height) {
          uneven.push({ row: pathOf(row), top: Math.round(l.top + scrollY), heights: l.heights.map((h) => Math.round(h * 10) / 10) });
        }
      }
    }
  }

  const notFound = /\bPage Not Found\b/i.test(document.body.innerText.slice(0, 2_000));
  return { screens, aboveFold, minFont, minFontSample, small, smallExamples, uneven, notFound };
}

async function measurePage(context, role, path, device) {
  const page = await context.newPage();
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const status = res ? res.status() : null;
    await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
    // Scroll through once so scroll-reveal content is shown, then measure from the top.
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      scrollTo(0, 0);
      await document.fonts.ready;
    });
    await page.waitForTimeout(800);
    const m = await page.evaluate(measure, {
      phone: device === "phone",
      tolerance: { top: LIMITS.evenRowTop, height: LIMITS.evenRowHeight },
    });
    const missing = (status != null && status >= 400) || m.notFound;
    return { role, path, device, status, url: new URL(page.url()).pathname + new URL(page.url()).search, missing, ...m };
  } catch (e) {
    return { role, path, device, error: String(e?.message ?? e).split("\n")[0].slice(0, 200) };
  } finally {
    await page.close();
  }
}

const keyOf = (r) => `${r.role} ${r.path} ${r.device}`;

async function measureAll() {
  const out = [];
  const browser = await chromium.launch();
  try {
    for (const [role, paths] of Object.entries(PAGES)) {
      for (const device of Object.keys(DEVICES)) {
        const context = await newContext(browser, role, device);
        try {
          for (const path of paths) {
            const r = await measurePage(context, role, path, device);
            out.push(r);
            const summary = r.error
              ? `error: ${r.error}`
              : `${r.missing ? "missing, " : ""}screens ${r.screens}, aboveFold ${r.aboveFold}, minFont ${r.minFont}px${r.small == null ? "" : `, small ${r.small}`}${r.uneven == null ? "" : `, uneven rows ${r.uneven.length}`}`;
            console.log(`${keyOf(r)}: ${summary}`);
            for (const u of r.uneven ?? []) console.log(`  uneven row ${u.row} at y=${u.top}: heights ${u.heights.join(" / ")} px`);
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------------------------

const pct = (a, b) => (a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : 0);
const fmtPct = (v) => `${v > 0 ? "+" : ""}${v}%`;
const fmtFont = (v) => (v == null ? "–" : `${v}px`);

function compare(base, head) {
  const byKey = new Map(base.map((r) => [keyOf(r), r]));
  const rows = [];
  const regressions = [];
  for (const h of head) {
    const key = keyOf(h);
    const b = byKey.get(key);
    const row = { key, role: h.role, path: h.path, device: h.device, base: b ?? null, head: h, issues: [] };
    rows.push(row);
    // Even rows are an absolute check on HEAD: reported whatever the base looked like.
    if (!h.error && !h.missing && h.device === "desktop") {
      for (const u of h.uneven ?? []) {
        const issue = `uneven row ${u.row} at y=${u.top}: heights ${u.heights.join(" / ")} px (differ by more than ${LIMITS.evenRowHeight}px)`;
        row.issues.push(issue);
        regressions.push({ key, message: issue });
      }
    }
    if (h.error || b?.error) {
      row.status = "error";
      notes.push({ key, message: `not compared: ${h.error ? `head ${h.error}` : `base ${b.error}`}` });
      continue;
    }
    if (!b) {
      row.status = "no base";
      notes.push({ key, message: "no base measurement" });
      continue;
    }
    if (b.missing && h.missing) {
      row.status = "skipped (404 on both)";
      continue;
    }
    if (b.missing || h.missing) {
      row.status = b.missing ? "new on head" : "missing on head";
      notes.push({ key, message: `${row.status} (base ${b.status}, head ${h.status})` });
      continue;
    }
    row.status = "compared";
    row.screensDelta = pct(b.screens, h.screens);
    const issues = [];
    if (h.device === "phone" && b.small != null && h.small != null && h.small > b.small + LIMITS.extraSmallTargets) {
      issues.push(`small targets ${b.small} → ${h.small} (more than +${LIMITS.extraSmallTargets}), e.g. ${h.smallExamples.join("; ")}`);
    }
    if (h.minFont != null && b.minFont != null && h.minFont < LIMITS.minFont && b.minFont >= LIMITS.minFont) {
      issues.push(`smallest text ${b.minFont}px → ${h.minFont}px (below ${LIMITS.minFont}px): ${h.minFontSample}`);
    }
    if (b.screens > 0 && (h.screens - b.screens) / b.screens > LIMITS.screensGrowth) {
      issues.push(`page length ${b.screens} → ${h.screens} screens (${fmtPct(row.screensDelta)}, limit +${LIMITS.screensGrowth * 100}%)`);
    }
    row.issues.push(...issues);
    for (const issue of issues) regressions.push({ key, message: issue });
  }
  return { rows, regressions };
}

function printTable(rows) {
  const header = ["page", "device", "screens base → head (Δ)", "aboveFold", "min font", "small targets", "uneven rows", "status"];
  const lines = rows.map((r) => {
    const b = r.base;
    const h = r.head;
    const uneven = h.device === "desktop" && h.uneven ? String(h.uneven.length) : "–";
    const comfort = r.issues.length ? `COMFORT (${r.issues.length})` : "ok";
    if (r.status !== "compared") return [`${r.role} ${r.path}`, r.device, "", "", "", "", uneven, r.issues.length ? `${r.status}, ${comfort}` : r.status];
    return [
      `${r.role} ${r.path}`,
      r.device,
      `${b.screens} → ${h.screens} (${fmtPct(r.screensDelta)})`,
      `${b.aboveFold} → ${h.aboveFold}`,
      `${fmtFont(b.minFont)} → ${fmtFont(h.minFont)}`,
      h.device === "phone" ? `${b.small} → ${h.small}` : "–",
      uneven,
      comfort,
    ];
  });
  const widths = header.map((c, i) => Math.max(c.length, ...lines.map((l) => String(l[i]).length)));
  const fmt = (cells) => `| ${cells.map((c, i) => String(c).padEnd(widths[i])).join(" | ")} |`;
  console.log(fmt(header));
  console.log(`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`);
  for (const l of lines) console.log(fmt(l));
}

// ---------------------------------------------------------------------------------------------

if (MODE === "compare" && !existsSync(FILE)) {
  // Nothing to compare against (the base build failed): reported below, not a comfort regression.
  console.log(`No base measurements at ${FILE} (did --capture run on the base server?).`);
}

const measured = await measureAll();

if (MODE === "capture") {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ baseUrl: BASE, capturedAt: new Date().toISOString(), pages: measured }, null, 2));
  console.log(`Captured ${measured.length} measurements in ${FILE}.`);
} else {
  const base = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")).pages ?? [] : [];
  const { rows, regressions } = compare(base, measured);
  console.log("");
  printTable(rows);
  // Every uneven dashboard row found on HEAD (desktop), also counted in `regressions`.
  const unevenRows = measured.flatMap((r) =>
    r.device === "desktop" && !r.error && !r.missing ? (r.uneven ?? []).map((u) => ({ key: keyOf(r), ...u })) : []
  );
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(
    REPORT,
    JSON.stringify({ mode: MODE, baseUrl: BASE, baseFile: FILE, limits: LIMITS, regressions, unevenRows, notes, rows }, null, 2)
  );
  console.log(`\nReport: ${REPORT}`);
  for (const n of notes) console.log(`note ${n.key}: ${n.message}`);
  if (!base.length) {
    // Not a comfort regression (the preservation checks already fail on a missing base): warn only.
    console.log("::warning title=Density::Base measurements missing, nothing was compared.");
  }
  if (regressions.length) {
    console.error(`\n${regressions.length} comfort regression(s):\n- ${regressions.map((r) => `${r.key}: ${r.message}`).join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log("No comfort regressions.");
  }
}
