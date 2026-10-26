/**
 * Elegance roadmap checks (docs/elegance-roadmap.md, ideas 9, 1 and 2) on a phone (390×844) as
 * student1, against the seeded database:
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
const VIEWPORT = { width: 390, height: 844 };
const TOUCH = 44;
const TABS = ["Home", "Skills", "Practice", "Coach", "Me"];

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

async function newPhoneContext(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem("averna_theme", "dark");
    localStorage.setItem("averna_onboarding_done_v1", "1");
    localStorage.setItem("averna_setup_done_v1", "1");
    localStorage.setItem("averna_seasonal", "0");
    sessionStorage.setItem("averna_pwa_dismissed", "1");
  });
  await ensureSignedIn(context, BASE, "student", STUDENT, signIn);
  return context;
}

async function open(context, path) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return page;
}

const round = (v) => Math.round(v * 10) / 10;

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

// ---------------------------------------------------------------------------------------------

const CASES = [
  ["1-today-hero", caseTodayHero],
  ["2-tab-bar", caseTabBar],
  ["3-return-bar", caseReturnBar],
  ["4-forecast", caseForecast],
];

const browser = await chromium.launch();
try {
  const context = await newPhoneContext(browser);
  try {
    for (const [id, run] of CASES) {
      const before = violations.length;
      try {
        await run(context);
      } catch (e) {
        violation(id, `check crashed: ${String(e?.message ?? e).split("\n")[0]}`);
      }
      checked.push({ case: id, violations: violations.length - before });
      console.log(`${id}: ${violations.length - before} violation(s)`);
    }
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, JSON.stringify({ baseUrl: BASE, viewport: VIEWPORT, checked, violations, notes }, null, 2));
console.log(`Report: ${REPORT}`);
for (const n of notes) console.log(`note ${n.case}: ${n.message}`);
if (violations.length) {
  console.error(`\n${violations.length} violation(s):\n- ${violations.map((v) => `${v.case}: ${v.message}`).join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("No violations: the elegance checks hold.");
}
