/**
 * Elegance roadmap checks (docs/elegance-roadmap.md) against the seeded database.
 *
 * Ideas 9, 1 and 2 on a phone (390×844) as student1:
 *   1 today-hero     the Daily Session hero starts in the first viewport and its Start / Continue
 *                    button ends inside it (bottom ≤ 844 px, page scrolled to the top)
 *   2 tab-bar        the bottom tab bar shows exactly Home · Skills · Practice · Coach · Me
 *   3 return-bar     a session step opened from the hero (`?from=session`) shows the
 *                    "Today's session" return bar, which links back to /dashboard
 *   4 forecast       /progress shows "Band forecast" and the what-if radiogroup has 4 options,
 *                    each at least 44 px tall (the seed has no test results, so /progress shows the
 *                    first-run guide instead; then the same card is checked on the Progress tab,
 *                    /dashboard?tab=progress, which always renders it — reported as a note)
 *
 * Idea 8 (reading comfort, native-language hints) as student1 on the phone and on a desktop
 * (1280×800), suffixed /phone and /desktop. Each case clears every comfort key of
 * lib/comfort/prefs.ts before and after it, so no other check sees its settings:
 *   5 comfort        /settings shows "Reading comfort"; Readable font, Line spacing "Loose", High
 *                    contrast and Text size "Large" put font-readable, leading-loose-ui,
 *                    contrast-high and text-scale-lg on <html>; with all of them on, /settings does
 *                    not scroll sideways at 320 px (scrollWidth ≤ clientWidth + 1) in the dark and
 *                    the light theme; after a full reload of /settings, and on /progress, the classes
 *                    are on <html> when <body> first appears (before React can hydrate, so they come
 *                    from COMFORT_SCRIPT) and at DOMContentLoaded, and the root font size grows
 *   6 reading-ruler  Alt+R shows the ruler ([data-reading-ruler]): aria-hidden, pointer-events none,
 *                    painted, announced in an aria-live status; the band follows the pointer onto a
 *                    link, the link is still what is hit there, and a click (desktop) / tap (phone)
 *                    opens it; the ruler stays on the next page and Alt+R hides it again
 *   7 l1-hints       with averna_l1=uz and averna_l1_when=always, the first Reading practice test
 *                    shows a visible Uzbek hint (lang="uz") under a question-group instruction; with
 *                    averna_l1=off no hint renders once the page has hydrated, and turning them on
 *                    from another tab then shows them (so "none" was not just "not ready yet").
 *                    Skipped with a note when the database has no Reading test to open
 *
 * Idea 10 as the seeded teacher on the phone and the desktop:
 *   8 needs-help     /teacher/dashboard shows "Who needs help today" with rows or the "Everyone is
 *                    on track today" empty state (the load-error state fails); on the phone every
 *                    button and link in the card is at least 44 px tall. Sideways scrolling at
 *                    320 px is checked by e2e/density.mjs
 *
 * Idea 7 as student1 on the phone:
 *   9 offline        /flashcards "Save for offline" (≥ 44 px) saves the first deck and the worker keeps
 *                    /offline; with the context offline, /offline lists the deck, one card is graded
 *                    ("Saved offline — … will sync") and queued; back online the queue drains through
 *                    POST /api/srs/review. Playwright's offline mode doesn't cut the worker's own
 *                    fetches, so the worker's offline serving is unit-tested (tests/offline-privacy).
 *                    Skipped with a note without a service worker or a due card; cleans up after itself
 *
 *   BASE_URL=http://localhost:3000 node e2e/elegance-checks.mjs   → e2e/report-elegance.json
 *
 * Exit code 1 when any check fails. Runs in CI after the screenshots (.github/workflows/screens.yml).
 */
import { chromium } from "playwright";
import { createRoleSessionCache } from "./role-session.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ensureSignedIn = createRoleSessionCache();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REPORT = process.env.REPORT ?? "e2e/report-elegance.json";
const STUDENT = { email: "student1@averna.com", password: "student123" };
const TEACHER = { email: "teacher@averna.com", password: "teacher123" };
const USERS = { student: STUDENT, teacher: TEACHER };
const VIEWPORT = { width: 390, height: 844 };
const DEVICES = {
  phone: { viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
/** Narrowest supported width (the sideways-scroll check). */
const NARROW = 320;
const TOUCH = 44;
const TABS = ["Home", "Skills", "Practice", "Coach", "Me"];

/** Every localStorage key of lib/comfort/prefs.ts (PREF_KEYS). */
const COMFORT_KEYS = [
  "averna_text_scale",
  "averna_font",
  "averna_line_spacing",
  "averna_contrast",
  "averna_ruler",
  "averna_l1",
  "averna_l1_when",
];
/** <html> classes of Readable font, Line spacing "Loose", High contrast and Text size "Large". */
const COMFORT_CLASSES = ["font-readable", "leading-loose-ui", "contrast-high", "text-scale-lg"];
/** An Uzbek hint (components/l1/l1-hint.tsx) inside a question group (components/exam/question-group.tsx). */
const HINT_UZ = 'section[aria-labelledby^="grp-"] [data-l1-hint="uz"] [lang="uz"]';

const violations = [];
const notes = [];
const checked = [];
const violation = (id, message) => violations.push({ case: id, message });
const note = (id, message) => notes.push({ case: id, message });

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
  try {
    await context.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("averna_theme", "dark");
      localStorage.setItem("averna_onboarding_done_v1", "1");
      localStorage.setItem("averna_setup_done_v1", "1");
      localStorage.setItem("averna_seasonal", "0");
      sessionStorage.setItem("averna_pwa_dismissed", "1");
    });
    await ensureSignedIn(context, BASE, role, USERS[role], signIn);
    return context;
  } catch (e) {
    await context.close();
    throw e;
  }
}

async function open(context, path) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return page;
}

const round = (v) => Math.round(v * 10) / 10;
const firstLine = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 160);

/** Polls `fn` (sync or async; truthy = done) every 100 ms; true when it held within `timeout` ms. */
async function until(fn, timeout = 5_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await Promise.resolve().then(fn).catch(() => false)) return true;
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** React has hydrated this element (its props are attached), so its handlers and effects are live. */
const isHydrated = (locator) => locator.first().evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")));

/** In the page: two animation frames (layout and effects settled), at most 1 s. */
const settle = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    setTimeout(resolve, 1_000);
  });

/** Removes every comfort key on this origin; true when any was set. */
const clearComfort = (page) =>
  page
    .evaluate((keys) => {
      let had = false;
      for (const k of keys) {
        if (localStorage.getItem(k) !== null) had = true;
        localStorage.removeItem(k);
      }
      return had;
    }, COMFORT_KEYS)
    .catch(() => false);

/** `open`, with the comfort keys cleared first (reloaded when any was set, so <html> starts clean). */
async function openClean(context, path) {
  const page = await open(context, path);
  if (await clearComfort(page)) {
    await page.reload({ waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  }
  return page;
}

// ---------------------------------------------------------------------------------------------

async function caseTodayHero(context) {
  const id = "1-today-hero";
  const page = await open(context, "/dashboard");
  try {
    const hero = page.getByTestId("today-session");
    await hero.waitFor({ state: "visible", timeout: 30_000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    const box = await hero.boundingBox();
    if (!box) return violation(id, "hero has no box");
    if (box.y < 0 || box.y >= VIEWPORT.height) violation(id, `hero top at ${round(box.y)}px is outside the first viewport (0–${VIEWPORT.height}px)`);
    const title = await page.locator("#today-session-title").innerText().catch(() => "");
    const cta = hero.locator('a[aria-label^="Start:"], a[aria-label^="Continue:"]');
    if ((await cta.count()) === 0) {
      if (/Session complete/i.test(title)) return note(id, "every step is done today, so the hero shows no Start / Continue button");
      return violation(id, `no Start / Continue button in the hero (title “${title}”)`);
    }
    const b = await cta.first().boundingBox();
    const label = await cta.first().getAttribute("aria-label");
    if (!b) return violation(id, `button “${label}” has no box`);
    const bottom = b.y + b.height;
    if (bottom > VIEWPORT.height) violation(id, `button “${label}” ends at ${round(bottom)}px, below the first viewport (${VIEWPORT.height}px)`);
    if (b.height < TOUCH) violation(id, `button “${label}” is ${round(b.height)}px tall (< ${TOUCH}px)`);
    note(id, `hero top ${round(box.y)}px, “${label}” bottom ${round(bottom)}px`);
  } finally {
    await page.close();
  }
}

async function caseTabBar(context) {
  const id = "2-tab-bar";
  const page = await open(context, "/dashboard");
  try {
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    await nav.waitFor({ state: "visible", timeout: 30_000 });
    const names = (await nav.locator("a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    if (names.join("|") !== TABS.join("|")) violation(id, `tab bar shows [${names.join(", ")}], expected [${TABS.join(", ")}]`);
    const current = await nav.locator('a[aria-current="page"]').allInnerTexts();
    if (current.map((t) => t.trim()).join("|") !== "Home") violation(id, `on /dashboard the current tab is [${current.join(", ")}], expected Home`);
  } finally {
    await page.close();
  }
}

async function caseReturnBar(context) {
  const id = "3-return-bar";
  const page = await open(context, "/dashboard");
  try {
    const hero = page.getByTestId("today-session");
    await hero.waitFor({ state: "visible", timeout: 30_000 });
    const step = hero.locator('ol a[href*="from=session"]').first();
    if ((await step.count()) === 0) return violation(id, "no session step link carries ?from=session");
    const href = await step.getAttribute("href");
    await Promise.all([page.waitForURL((u) => u.searchParams.get("from") === "session", { timeout: 30_000 }), step.click()]);
    const bar = page.getByTestId("session-return-bar");
    await bar.waitFor({ state: "visible", timeout: 30_000 });
    const text = (await bar.innerText()).replace(/\s+/g, " ").trim();
    if (!/Today['’]s session/.test(text)) violation(id, `return bar on ${href} reads “${text}”, expected “Today's session …”`);
    const back = await bar.locator("a").first().getAttribute("href");
    if (back !== "/dashboard") violation(id, `return bar links to ${back}, expected /dashboard`);
    const b = await bar.locator("a").first().boundingBox();
    if (b && b.height < TOUCH) violation(id, `return bar link is ${round(b.height)}px tall (< ${TOUCH}px)`);
    note(id, `${href}: “${text}”`);
  } finally {
    await page.close();
  }
}

async function checkForecast(page, id, where) {
  const heading = page.getByRole("heading", { name: "Band forecast", exact: true });
  await heading.waitFor({ state: "visible", timeout: 30_000 });
  const group = page.locator('[role="radiogroup"][aria-labelledby="whatif-title"]');
  await group.waitFor({ state: "visible", timeout: 10_000 });
  const radios = group.locator('[role="radio"]');
  const n = await radios.count();
  if (n !== 4) violation(id, `${where}: what-if radiogroup has ${n} options, expected 4`);
  const heights = [];
  for (let i = 0; i < n; i++) {
    const b = await radios.nth(i).boundingBox();
    heights.push(b ? round(b.height) : 0);
  }
  const short = heights.filter((h) => h < TOUCH);
  if (short.length) violation(id, `${where}: what-if options are ${heights.join(" / ")}px tall (some < ${TOUCH}px)`);
  // The control works: picking +2 checks it and the live summary is not empty.
  if (n === 4) {
    await radios.nth(2).click();
    const checkedNow = await radios.nth(2).getAttribute("aria-checked");
    if (checkedNow !== "true") violation(id, `${where}: “+2” is not checked after a tap`);
    const summary = (await page.getByTestId("whatif-summary").innerText().catch(() => "")).trim();
    if (!summary) violation(id, `${where}: the what-if summary is empty`);
  }
  note(id, `${where}: 4 options ${heights.join(" / ")}px`);
}

async function caseForecast(context) {
  const id = "4-forecast";
  const page = await open(context, "/progress");
  try {
    const forecast = page.getByRole("heading", { name: "Band forecast", exact: true });
    const firstRun = page.getByText("Take a baseline test", { exact: true });
    await Promise.race([
      forecast.waitFor({ state: "visible", timeout: 30_000 }),
      firstRun.waitFor({ state: "visible", timeout: 30_000 }),
    ]).catch(() => {});
    if (await forecast.isVisible()) return await checkForecast(page, id, "/progress");
    if (await firstRun.isVisible()) {
      note(id, "/progress shows the first-run guide (no test results in the seed); checked the Progress tab instead");
      const tab = await open(context, "/dashboard?tab=progress");
      try {
        await checkForecast(tab, id, "/dashboard?tab=progress");
      } finally {
        await tab.close();
      }
      return;
    }
    violation(id, "/progress shows neither “Band forecast” nor the first-run guide");
  } finally {
    await page.close();
  }
}

// --------------------------------------------------------------------- idea 8: reading comfort

/** Clicks `control` until its `attr` reads "true"; a click that lands before hydration is retried. */
async function turnOn(control, attr) {
  for (let i = 0; i < 3; i++) {
    if ((await control.getAttribute(attr)) === "true") return true;
    await control.click();
    if (await until(async () => (await control.getAttribute(attr)) === "true", 5_000)) return true;
  }
  return false;
}

/** Init script: <html>'s classes when <body> first appears (after the <head> scripts, before React can hydrate). */
function recordEarlyClasses() {
  if (window !== window.top) return;
  const take = () => {
    if (!document.body) return false;
    window.__comfortEarly = [...document.documentElement.classList];
    return true;
  };
  if (take()) return;
  const observer = new MutationObserver(() => {
    if (take()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

/** In the page: sideways overflow of the document, with up to three of the widest offenders. */
async function sidewaysOverflow() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    setTimeout(resolve, 1_000);
  });
  const root = document.documentElement;
  const cw = root.clientWidth;
  const wide = [];
  if (root.scrollWidth > cw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= cw + 1 || getComputedStyle(el).position === "fixed") continue;
      wide.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 70)}"> +${Math.round(r.right - cw)}px`);
      if (wide.length === 3) break;
    }
  }
  return { scrollWidth: root.scrollWidth, clientWidth: cw, wide };
}

async function caseComfort(context, { id, device }) {
  const page = await openClean(context, "/settings");
  try {
    const heading = page.getByRole("heading", { name: "Reading comfort", exact: true });
    if (!(await heading.waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false))) {
      return violation(id, "/settings shows no “Reading comfort” group");
    }
    const font = page.getByRole("switch", { name: /^Readable font/ });
    const controls = [
      ["Readable font", font, "aria-checked"],
      ["Line spacing “Loose”", page.getByRole("group", { name: "Line spacing", exact: true }).getByRole("button", { name: "Loose", exact: true }), "aria-pressed"],
      ["High contrast", page.getByRole("switch", { name: /^High contrast/ }), "aria-checked"],
      ["Text size “Large”", page.getByRole("group", { name: "Text size", exact: true }).getByRole("button", { name: "Large", exact: true }), "aria-pressed"],
    ];
    await until(() => isHydrated(font), 15_000);
    for (const [name, control, attr] of controls) {
      if (!(await turnOn(control, attr))) violation(id, `/settings: ${name} does not turn on (${attr} is not "true" after a click)`);
    }
    const live = await page.evaluate(() => [...document.documentElement.classList]);
    const liveMissing = COMFORT_CLASSES.filter((c) => !live.includes(c));
    if (liveMissing.length) violation(id, `/settings: with the settings on, <html> lacks ${liveMissing.join(", ")} (class “${live.join(" ")}”)`);

    // 320 px wide, everything on (contrast-high included), in both themes: no sideways scroll.
    const size = page.viewportSize() ?? DEVICES[device].viewport;
    const widths = [];
    await page.setViewportSize({ width: NARROW, height: size.height });
    try {
      await until(() => page.evaluate((w) => innerWidth === w, NARROW), 5_000);
      for (const theme of ["dark", "light"]) {
        const button = page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: theme === "dark" ? "Dark" : "Light", exact: true });
        await button.click();
        const applied = await until(() => page.evaluate((t) => document.documentElement.classList.contains(t), theme), 5_000);
        if (!applied) {
          violation(id, `/settings ${NARROW}px: the ${theme} theme does not apply`);
          continue;
        }
        const o = await page.evaluate(sidewaysOverflow);
        widths.push(`${theme} ${o.scrollWidth}/${o.clientWidth}px`);
        if (o.scrollWidth > o.clientWidth + 1) {
          violation(
            id,
            `/settings ${NARROW}px, ${theme} theme, html.${live.filter((c) => COMFORT_CLASSES.includes(c)).join(".")}: scrolls sideways (scrollWidth ${o.scrollWidth}px > clientWidth ${o.clientWidth}px + 1)${o.wide.length ? `: ${o.wide.join("; ")}` : ""}`
          );
        }
      }
    } finally {
      await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click().catch(() => {});
      await page.setViewportSize(size);
    }

    // A full reload, then a page without the dashboard's Customize panel: the classes are there
    // before hydration (COMFORT_SCRIPT), both when <body> first appears and at DOMContentLoaded.
    await page.addInitScript(recordEarlyClasses);
    const seen = [];
    for (const [path, load] of [
      ["/settings", () => page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 })],
      ["/progress", () => page.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded", timeout: 60_000 })],
    ]) {
      await load();
      const r = await page.evaluate(() => ({
        dcl: [...document.documentElement.classList],
        early: window.__comfortEarly ?? null,
        hydrated: !!document.body && Object.keys(document.body).some((k) => k.startsWith("__reactFiber$")),
      }));
      const atDcl = COMFORT_CLASSES.filter((c) => !r.dcl.includes(c));
      if (atDcl.length) violation(id, `${path} after a reload: <html> lacks ${atDcl.join(", ")} at DOMContentLoaded (class “${r.dcl.join(" ")}”)`);
      if (!r.early) note(id, `${path}: no snapshot of <html> at the first <body> (the init script did not run)`);
      else {
        const early = COMFORT_CLASSES.filter((c) => !r.early.includes(c));
        if (early.length) violation(id, `${path} after a reload: <html> lacks ${early.join(", ")} before hydration (class at the first <body> “${r.early.join(" ")}”)`);
      }
      seen.push(`${path} ${r.hydrated ? "hydrated" : "not hydrated"} at DOMContentLoaded`);
    }
    await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
    const rootPx = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
    if (!(rootPx > 16)) violation(id, `/progress: Text size “Large” leaves the root font size at ${rootPx}px (expected more than 16px)`);
    note(id, `${COMFORT_CLASSES.join(", ")} on <html> live and after reloads (${seen.join(", ")}); ${NARROW}px scrollWidth/clientWidth: ${widths.join(", ")}; /progress root font ${rootPx}px`);
  } finally {
    await clearComfort(page);
    await page.close();
  }
}

/** Alt+R until the ruler is `want` ("on" / "off"); pressed again only while the setting itself is unchanged (pre-hydration key). */
async function toggleRuler(page, want) {
  const ruler = page.locator("[data-reading-ruler]");
  const done = async () => ((await ruler.count()) > 0) === (want === "on");
  for (let i = 0; i < 3; i++) {
    if (await done()) return true;
    const saved = await page.evaluate(() => localStorage.getItem("averna_ruler")).catch(() => null);
    if ((saved === "on") !== (want === "on")) await page.keyboard.press("Alt+KeyR");
    if (await until(done, 5_000)) return true;
  }
  return false;
}

async function caseRuler(context, { id, device }) {
  const page = await openClean(context, "/settings");
  try {
    const ruler = page.locator("[data-reading-ruler]");
    const link = page.getByRole("link", { name: /Edit profile/ }).first();
    await link.waitFor({ state: "visible", timeout: 30_000 });
    await until(() => isHydrated(page.getByRole("switch", { name: /^Reading ruler/ })), 15_000);
    if (!(await toggleRuler(page, "on"))) return violation(id, "Alt+R does not show the reading ruler ([data-reading-ruler])");

    const r = await ruler.evaluate((root) => ({
      ariaHidden: root.getAttribute("aria-hidden"),
      pointer: [...new Set([root, ...root.querySelectorAll("*")].map((el) => getComputedStyle(el).pointerEvents))],
      position: getComputedStyle(root).position,
    }));
    if (r.ariaHidden !== "true") violation(id, `the ruler has aria-hidden="${r.ariaHidden}" (expected "true")`);
    if (r.pointer.some((p) => p !== "none")) violation(id, `the ruler has pointer-events ${r.pointer.join(" / ")} (expected none everywhere)`);
    if (r.position !== "fixed") violation(id, `the ruler is position: ${r.position} (expected fixed)`);
    if (!(await until(() => ruler.evaluate((el) => getComputedStyle(el).opacity === "1"), 5_000))) {
      violation(id, "the ruler stays transparent after Alt+R (opacity is not 1)");
    }
    if (!(await until(async () => (await page.locator('[role="status"][aria-live="polite"]', { hasText: "Reading ruler on" }).count()) > 0, 3_000))) {
      violation(id, "turning the ruler on is not announced (“Reading ruler on” in an aria-live status)");
    }

    // The band follows the pointer onto "Edit profile"; the link is still what is hit there, and opens.
    const href = await link.getAttribute("href");
    await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = await link.boundingBox();
    if (!href || !box) return violation(id, "“Edit profile” has no href or box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    const under = await until(
      () =>
        page.evaluate((y) => {
          const b = document.querySelector("[data-reading-ruler] .reading-ruler__band")?.getBoundingClientRect();
          return !!b && b.top <= y && y <= b.bottom;
        }, y),
      5_000
    );
    if (!under) violation(id, `the band does not follow the pointer to y=${round(y)}px`);
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return { ruler: !!el?.closest("[data-reading-ruler]"), href: el?.closest("a")?.getAttribute("href") ?? null, tag: el?.tagName.toLowerCase() ?? null };
      },
      { x, y }
    );
    if (hit.ruler) violation(id, `the ruler, not “Edit profile”, is hit at (${round(x)}, ${round(y)})`);
    else if (hit.href !== href) violation(id, `<${hit.tag}> (link ${hit.href}), not “Edit profile”, is hit at (${round(x)}, ${round(y)})`);
    const how = device === "phone" ? "tap" : "click";
    if (device === "phone") await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    const opened = await page.waitForURL((u) => u.pathname === href, { timeout: 30_000 }).then(() => true, () => false);
    if (!opened) violation(id, `a ${how} on “Edit profile” under the ruler does not open ${href} (still on ${new URL(page.url()).pathname})`);
    else if ((await ruler.count()) === 0) violation(id, `the ruler is gone on ${href} (it is a saved setting)`);
    if (!(await toggleRuler(page, "off"))) violation(id, "Alt+R does not hide the reading ruler again");
    note(id, `Alt+R on/off; band under “Edit profile” at y=${round(y)}px, the ${how} opened ${opened ? href : "nothing"}`);
  } finally {
    await clearComfort(page);
    await page.close();
  }
}

/** A Reading practice test in its own tab (close it with page.close(), which skips the leave guard). */
async function openReadingTest(context, href) {
  const page = await context.newPage();
  try {
    await page.goto(new URL(href, BASE).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('.exam-shell nav[aria-label="Question navigator"]', { timeout: 60_000 });
    await page.waitForSelector('section[aria-labelledby^="grp-"]', { state: "attached", timeout: 30_000 });
    return { page };
  } catch (e) {
    await page.close();
    return { reason: `${href} did not open as a practice test with question groups (${firstLine(e)})` };
  }
}

async function caseL1Hints(context, { id, device }) {
  const lib = await openClean(context, "/learning/reading");
  const store = (values) =>
    lib.evaluate((v) => {
      for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val);
    }, values);
  try {
    const href = await lib.evaluate(
      () =>
        Array.from(document.querySelectorAll('a[href^="/learning/reading/"]'))
          .map((a) => a.getAttribute("href"))
          .find((h) => h && !/\/result(\/|$|\?)/.test(h)) ?? null
    );
    if (!href) return note(id, "skipped: no Reading practice test on /learning/reading (no exam content in this database)");

    // Uzbek hints at any level.
    await store({ averna_l1: "uz", averna_l1_when: "always" });
    const on = await openReadingTest(context, href);
    if (!on.page) return note(id, `skipped: ${on.reason}`);
    try {
      const hints = on.page.locator(HINT_UZ);
      if (!(await until(async () => (await hints.count()) > 0, 20_000))) {
        violation(id, `${href}: no Uzbek hint (lang="uz") under any question-group instruction with averna_l1=uz, averna_l1_when=always`);
      } else {
        // Phones show one pane at a time: the questions are on the "Questions" tab.
        const tab = on.page.locator('[role="tablist"][aria-label="View"] [role="tab"]', { hasText: /question/i }).first();
        if (device === "phone" && (await tab.isVisible().catch(() => false))) await tab.click();
        if (!(await until(() => hints.first().isVisible(), 5_000))) {
          violation(id, `${href}: the Uzbek hint is in the page but not visible${device === "phone" ? " on the Questions tab" : ""}`);
        }
        const sample = ((await hints.first().textContent()) ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
        note(id, `${href}: ${await hints.count()} Uzbek hint(s) under question-group instructions, e.g. “${sample}”`);
      }
    } finally {
      await on.page.close();
    }

    // Hints off.
    await store({ averna_l1: "off" });
    const off = await openReadingTest(context, href);
    if (!off.page) return note(id, `averna_l1=off not checked: ${off.reason}`);
    try {
      const hydrated = await until(() => isHydrated(off.page.locator('section[aria-labelledby^="grp-"]')), 20_000);
      await off.page.evaluate(settle);
      const count = await off.page.locator("[data-l1-hint]").count();
      if (count) violation(id, `${href}: ${count} hint(s) render with averna_l1=off`);
      // Control: hints switched on in another tab (storage event) appear here, so the page was live.
      await store({ averna_l1: "uz" });
      if (!(await until(async () => (await off.page.locator(HINT_UZ).count()) > 0, 10_000))) {
        violation(id, `${href}: turning hints on from another tab shows none here, so the "off" result (${count}) is not conclusive`);
      }
      if (!hydrated) note(id, `${href}: hydration of the question groups was not confirmed before counting hints with averna_l1=off`);
    } finally {
      await off.page.close();
    }
  } finally {
    await clearComfort(lib);
    await lib.close();
  }
}

// ----------------------------------------------------------------- idea 10: who needs help today

async function caseNeedsHelp(context, { id, device }) {
  const page = await open(context, "/teacher/dashboard");
  try {
    const card = page.getByTestId("needs-help");
    if (!(await card.waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false))) {
      return violation(id, "/teacher/dashboard shows no “Who needs help today” card ([data-testid=needs-help])");
    }
    if (!(await card.getByRole("heading", { name: "Who needs help today", exact: true }).isVisible())) {
      violation(id, "the needs-help card has no visible “Who needs help today” heading");
    }
    const rows = await card.getByTestId("needs-help-row").count();
    const empty = await card.getByText("Everyone is on track today", { exact: true }).isVisible();
    const handled = await card.getByText(/Everyone on today.s list is handled/).isVisible();
    if (await card.getByText(/couldn.t be loaded/).isVisible()) violation(id, "the needs-help card shows its load-error state");
    else if (!rows && !empty && !handled) violation(id, "the needs-help card shows neither rows nor the “Everyone is on track today” empty state");
    const state = rows ? `${rows} row(s)` : empty ? "empty state “Everyone is on track today”" : handled ? "every row done today" : "no content";

    if (device === "phone") {
      const targets = await card.evaluate((root) =>
        [...root.querySelectorAll('a, button, [role="button"]')]
          .filter((el) => {
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.display !== "none" && st.visibility !== "hidden" && r.width > 1 && r.height > 1;
          })
          .map((el) => ({
            name: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
            h: el.getBoundingClientRect().height,
          }))
      );
      const short = targets.filter((t) => t.h < TOUCH - 0.5);
      if (short.length) violation(id, `buttons under ${TOUCH}px: ${short.map((t) => `“${t.name}” ${round(t.h)}px`).join("; ")}`);
      note(id, `${state}; ${targets.length} button(s)/link(s), ${short.length} under ${TOUCH}px`);
    } else {
      note(id, state);
    }
  } finally {
    await page.close();
  }
}

// ------------------------------------------------------------------- idea 7: instant and offline

/** Removes this device's offline packs, saved shell and grade queue (so no later check sees them). */
const clearOffline = (page) =>
  page
    .evaluate(async () => {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("averna-offline");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
      for (const key of await caches.keys()) if (key.startsWith("averna-offline-")) await caches.delete(key);
      for (const key of ["averna_offline_queue_v1", "averna_offline_owner"]) localStorage.removeItem(key);
    })
    .catch(() => {});

async function caseOffline(context, { id }) {
  const page = await open(context, "/flashcards");
  try {
    const worker = await page.evaluate(() => ("serviceWorker" in navigator ? navigator.serviceWorker.getRegistration().then((r) => !!r) : false)).catch(() => false);
    if (!worker && !(await until(() => page.evaluate(() => navigator.serviceWorker?.getRegistration().then((r) => !!r)), 15_000))) {
      return note(id, "no service worker registered on this build: skipped");
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: "load", timeout: 60_000 });
    }
    const save = page.getByRole("button", { name: /^Save for offline/ }).first();
    if (!(await until(() => save.isVisible(), 15_000))) return note(id, "/flashcards shows no “Save for offline” button (no deck, or this browser can't keep packs): skipped");
    const b = await save.boundingBox();
    if (b && b.height < TOUCH) violation(id, `“Save for offline” is ${round(b.height)}px tall (< ${TOUCH}px)`);
    await until(() => isHydrated(save), 15_000);
    await save.click();
    if (!(await until(() => page.getByText(/Saved for offline ·/).first().isVisible(), 15_000))) return violation(id, "the deck did not save for offline");
    const shellFiles = async () =>
      page.evaluate(async () => {
        const c = await caches.open("averna-offline-shell-v1");
        return (await c.match("/offline", { ignoreSearch: true })) ? (await c.keys()).length : 0;
      });
    if (!(await until(async () => (await shellFiles()) > 0, 30_000))) violation(id, "the worker did not keep the /offline page after the first save");

    // Playwright's offline mode cuts the page's network, not the worker's own fetches: the worker's
    // offline serving is covered by tests/offline-privacy.test.ts; this checks IndexedDB packs,
    // grading with no connection and the queue sync.
    await context.setOffline(true);
    let queued = 0;
    try {
      await page.goto(`${BASE}/offline`, { waitUntil: "load", timeout: 60_000 });
      const heading = page.getByRole("heading", { name: "Saved on this device" });
      if (!(await until(() => heading.isVisible(), 15_000))) return violation(id, "offline: /offline shows no “Saved on this device”");
      const study = page.getByRole("button", { name: /^Study: / }).first();
      if (!(await until(() => study.isVisible(), 10_000))) return violation(id, "offline: the saved deck is not listed on /offline");
      await until(() => isHydrated(study), 15_000);
      await study.click();
      const cardButton = page.getByRole("button", { name: /Tap to reveal the meaning/ });
      if (!(await until(() => cardButton.isVisible(), 10_000))) return note(id, "the saved deck has no card due right now (the seed reviewed them all): grading skipped");
      await cardButton.click();
      await page.getByRole("button", { name: /^Good/ }).click();
      if (!(await until(() => page.getByText(/Saved offline — \d+ reviews? will sync/).isVisible(), 5_000))) violation(id, "offline: no “Saved offline — … will sync” after grading a card");
      queued = await page.evaluate(() => JSON.parse(localStorage.getItem("averna_offline_queue_v1") || "[]").length);
      if (queued < 1) violation(id, "offline: the grade was not queued");
    } finally {
      await context.setOffline(false);
    }
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    if (queued && !(await until(() => page.evaluate(() => !localStorage.getItem("averna_offline_queue_v1")), 20_000))) {
      violation(id, "back online: the queued review did not sync");
    }
    note(id, `deck saved, shell kept (${await shellFiles()} entries), ${queued} review(s) graded offline and synced`);
  } finally {
    // The worker may still be refreshing the saved /offline page from the last visit: let it finish first.
    await page.waitForTimeout(1_500).catch(() => {});
    await clearOffline(page);
    await page.close();
  }
}

// ---------------------------------------------------------------------------------------------

/** One signed-in context per role and device; its cases run in order. */
const SUITES = [
  {
    role: "student",
    device: "phone",
    cases: [
      ["1-today-hero", caseTodayHero],
      ["2-tab-bar", caseTabBar],
      ["3-return-bar", caseReturnBar],
      ["4-forecast", caseForecast],
      ["5-comfort/phone", caseComfort],
      ["6-reading-ruler/phone", caseRuler],
      ["7-l1-hints/phone", caseL1Hints],
      ["9-offline/phone", caseOffline],
    ],
  },
  {
    role: "student",
    device: "desktop",
    cases: [
      ["5-comfort/desktop", caseComfort],
      ["6-reading-ruler/desktop", caseRuler],
      ["7-l1-hints/desktop", caseL1Hints],
    ],
  },
  { role: "teacher", device: "phone", cases: [["8-needs-help/phone", caseNeedsHelp]] },
  { role: "teacher", device: "desktop", cases: [["8-needs-help/desktop", caseNeedsHelp]] },
];

const browser = await chromium.launch();
try {
  for (const { role, device, cases } of SUITES) {
    let context;
    try {
      context = await newContext(browser, role, device);
    } catch (e) {
      // A failed sign-in fails this suite's cases; the other suites still run.
      for (const [id] of cases) {
        violation(id, `setup crashed (${role} on ${device}): ${firstLine(e)}`);
        checked.push({ case: id, role, device, violations: 1 });
        console.log(`${id}: 1 violation(s)`);
      }
      continue;
    }
    try {
      for (const [id, run] of cases) {
        const before = violations.length;
        try {
          await run(context, { id, role, device });
        } catch (e) {
          violation(id, `check crashed: ${String(e?.message ?? e).split("\n")[0]}`);
        }
        checked.push({ case: id, role, device, violations: violations.length - before });
        console.log(`${id}: ${violations.length - before} violation(s)`);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(
  REPORT,
  JSON.stringify(
    {
      baseUrl: BASE,
      viewport: VIEWPORT,
      viewports: { phone: DEVICES.phone.viewport, desktop: DEVICES.desktop.viewport, narrow: NARROW },
      checked,
      violations,
      notes,
    },
    null,
    2
  )
);
console.log(`Report: ${REPORT}`);
for (const n of notes) console.log(`note ${n.case}: ${n.message}`);
if (violations.length) {
  console.error(`\n${violations.length} violation(s):\n- ${violations.map((v) => `${v.case}: ${v.message}`).join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("No violations: the elegance checks hold.");
}
