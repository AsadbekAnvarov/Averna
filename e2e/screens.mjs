/**
 * Visual smoke test: signs in as each seeded demo user and screenshots the key
 * screens on a phone (and a few on desktop), in the dark and the light theme.
 * Also fails when a page throws, logs a console error or ends on an error page.
 *
 *   BASE_URL=http://localhost:3000 node e2e/screens.mjs
 *
 * Runs in CI (.github/workflows/screens.yml) against a freshly seeded database;
 * the screenshots are uploaded as the "screens" artifact.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "screens";
mkdirSync(OUT, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const USERS = {
  student: { email: "student1@averna.com", password: "student123" },
  teacher: { email: "teacher@averna.com", password: "teacher123" },
  admin: { email: "admin@averna.com", password: "admin123" },
};

/** [name, path, optional action before the shot] */
const PAGES = {
  student: [
    ["dashboard-today", "/dashboard"],
    ["dashboard-learn", "/dashboard", (p) => p.getByRole("button", { name: "Learn" }).first().click()],
    ["dashboard-progress", "/dashboard", (p) => p.getByRole("button", { name: "Progress" }).first().click()],
    ["dashboard-class", "/dashboard", (p) => p.getByRole("button", { name: "Class" }).first().click()],
    ["dashboard-play", "/dashboard", (p) => p.getByRole("button", { name: "Play" }).first().click()],
    ["menu-open", "/dashboard", (p) => p.getByRole("button", { name: "Open navigation" }).click()],
    ["progress", "/progress"],
    ["progress-skills", "/progress/skills"],
    ["progress-streaks", "/progress/streaks"],
    ["progress-achievements", "/progress/achievements"],
    ["rankings", "/rankings"],
    ["rankings-leagues", "/rankings/leagues"],
    ["rankings-teams", "/rankings/teams"],
    ["studio", "/studio"],
    ["studio-warm-up", "/studio/warm-up"],
    ["learning", "/learning"],
    ["settings", "/settings"],
    ["profile", "/profile"],
    ["messages", "/messages"],
    ["calendar", "/calendar"],
    ["learning-reading", "/learning/reading"],
    ["learning-listening", "/learning/listening"],
  ],
  teacher: [
    ["teacher-dashboard", "/teacher/dashboard"],
    ["teacher-reviews", "/teacher/reviews"],
    ["teacher-students", "/teacher/students"],
    ["teacher-calendar", "/teacher/calendar"],
    ["teacher-homework", "/teacher/homework"],
    ["teacher-gradebook", "/teacher/gradebook"],
    ["teacher-attendance", "/teacher/attendance"],
    ["teacher-messages", "/messages"],
  ],
  admin: [
    ["admin-dashboard", "/admin/dashboard"],
    ["admin-placement", "/admin/placement"],
    ["admin-groups", "/admin/groups"],
    ["admin-finance", "/admin/finance"],
    ["admin-analytics", "/admin/analytics"],
    ["admin-teachers", "/admin/teachers"],
    ["admin-content", "/admin/content"],
    ["admin-messages", "/messages"],
  ],
};

/**
 * IELTS libraries whose first test is opened in its own tab (student only) and
 * shot on each exam pane: Passage and Questions on the phone's tab switcher,
 * the side-by-side layout on desktop (Listening has a single column).
 */
const EXAMS = [
  ["reading", "/learning/reading"],
  ["listening", "/learning/listening"],
];

/** Blocked audio autoplay in headless Chromium — not a bug in the page. */
const AUTOPLAY_NOISE = /NotAllowedError|play\(\) failed because the user didn't interact/i;

/** Old URLs that must keep working. */
const REDIRECTS = [
  ["/analytics", "/progress"],
  ["/achievements", "/progress/achievements"],
  ["/leagues", "/rankings/leagues"],
  ["/team-challenge", "/rankings/teams"],
];

const problems = [];
const report = [];

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

/** `ignore` — extra noise to drop for this page (e.g. AUTOPLAY_NOISE on exams). */
function watch(page, label, ignore) {
  page.on("pageerror", (e) => {
    if (ignore?.test(`${e.name}: ${e.message}`)) return;
    problems.push(`${label}: page error: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Third-party / environment noise that isn't a bug in the page itself.
    if (/favicon|Failed to load resource: the server responded with a status of 40[134]|ERR_CONNECTION|api\/averna-ai|api\/learning\/podcast/i.test(text)) return;
    if (ignore?.test(text)) return;
    problems.push(`${label}: console error: ${text.slice(0, 300)}`);
  });
}

async function shoot(context, role, theme, device) {
  const page = await context.newPage();
  const pages = device === "desktop" ? PAGES[role].filter(([n]) => !n.startsWith("menu")).slice(0, 3) : PAGES[role];
  for (const [name, path, action] of pages) {
    const label = `${theme}/${device}/${name}`;
    watch(page, label);
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 }).catch((e) => {
      problems.push(`${label}: navigation failed: ${e.message}`);
      return null;
    });
    if (res && res.status() >= 400) problems.push(`${label}: HTTP ${res.status()}`);
    if (action) {
      await action(page).catch((e) => problems.push(`${label}: action failed: ${e.message}`));
      await page.waitForTimeout(700);
    }
    await inspect(page, label, device, `${OUT}/${theme}-${device}-${role}-${name}.png`);
    page.removeAllListeners("pageerror");
    page.removeAllListeners("console");
  }
  await page.close();
}

/**
 * Opens the first test of each IELTS library in a separate tab and shoots its
 * panes. The tab is closed with page.close(), which skips beforeunload, so the
 * exam's leave guard can't hold it open.
 */
async function shootExams(context, theme, device) {
  const list = await context.newPage();
  for (const [skill, path] of EXAMS) {
    const base = `${theme}/${device}/exam-${skill}`;
    const ok = await list.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 }).catch((e) => {
      problems.push(`${base}: library navigation failed: ${e.message}`);
      return null;
    });
    if (!ok) continue;
    const href = await list
      .$$eval(`a[href^="${path}/"]`, (as) => as.map((a) => a.getAttribute("href")).find((h) => h && !h.includes("result")))
      .catch(() => undefined);
    if (!href) {
      problems.push(`${base}: no test link on ${path}`);
      continue;
    }
    const page = await context.newPage();
    watch(page, base, AUTOPLAY_NOISE);
    const res = await page.goto(new URL(href, BASE).href, { waitUntil: "networkidle", timeout: 60_000 }).catch((e) => {
      problems.push(`${base}: navigation failed: ${e.message}`);
      return null;
    });
    if (res && res.status() >= 400) problems.push(`${base}: HTTP ${res.status()}`);
    if (res) {
      await page.waitForTimeout(700);
      // The phone's Passage / Questions switcher (hidden from lg up and on Listening).
      const tabs = page.locator('[role="tablist"][aria-label="View"] [role="tab"]');
      const names = (await tabs.first().isVisible().catch(() => false)) ? await tabs.allTextContents() : [];
      if (names.length) {
        for (let i = 0; i < names.length; i++) {
          const pane = names[i].trim().toLowerCase() || `pane-${i}`;
          const label = `${base}-${pane}`;
          await tabs.nth(i).click().catch((e) => problems.push(`${label}: tab click failed: ${e.message}`));
          await page.waitForTimeout(500);
          await inspect(page, label, device, `${OUT}/${theme}-${device}-student-exam-${skill}-${pane}.png`);
        }
      } else {
        await inspect(page, base, device, `${OUT}/${theme}-${device}-student-exam-${skill}.png`);
      }
    }
    page.removeAllListeners("pageerror");
    page.removeAllListeners("console");
    await page.close();
  }
  await list.close();
}

/** The shared checks + full-page screenshot for the page as it is now. */
async function inspect(page, label, device, file) {
  // Scroll through once so scroll-reveal content is shown, then settle.
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900); // entrance animations
  // Content that takes up space but can't be seen (stuck at opacity 0).
  const ghosts = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const st = getComputedStyle(el);
      if (st.opacity !== "0" || st.position === "fixed" || st.position === "absolute") continue;
      if (el.closest('[aria-hidden="true"]') || out.some((o) => o.el.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 40) continue;
      out.push({ el, text: `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 70)}"> “${(el.textContent ?? "").trim().slice(0, 50)}”` });
      if (out.length === 3) break;
    }
    return out.map((o) => o.text);
  });
  for (const g of ghosts) problems.push(`${label}: invisible content: ${g}`);
  const body = (await page.textContent("body").catch(() => "")) ?? "";
  if (/Application error|Something went wrong|Internal Server Error/i.test(body)) problems.push(`${label}: error page shown`);
  // Anything wider than the screen is either sideways scrolling or content cut
  // off by the page's overflow clip. Elements inside their own scroll/clip
  // container, fixed bars and absolutely placed decoration are fine.
  if (device === "phone") {
    const wide = await page.evaluate(() => {
      const vw = window.innerWidth;
      const contained = (el) => {
        for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== "visible") return true;
        }
        return false;
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) continue;
        const pos = getComputedStyle(el).position;
        if (pos === "fixed" || pos === "absolute" || contained(el)) continue;
        out.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 80)}"> +${Math.round(r.right - vw)}px`);
        if (out.length === 3) break;
      }
      return out;
    });
    for (const w of wide) problems.push(`${label}: wider than the screen: ${w}`);
  }
  await page.screenshot({ path: file, fullPage: true });
  report.push({ label, url: page.url() });
}

const browser = await chromium.launch();
try {
  for (const theme of ["dark", "light"]) {
    for (const [role, creds] of Object.entries(USERS)) {
      for (const device of ["phone", "desktop"]) {
        const context = await browser.newContext(device === "phone" ? PHONE : DESKTOP);
        await context.addInitScript((t) => {
          localStorage.setItem("averna_theme", t);
          localStorage.setItem("averna_onboarding_done_v1", "1");
          localStorage.setItem("averna_setup_done_v1", "1");
          localStorage.setItem("averna_seasonal", "0");
          sessionStorage.setItem("averna_pwa_dismissed", "1");
        }, theme);
        await signIn(context, creds);
        await shoot(context, role, theme, device);
        if (role === "student") await shootExams(context, theme, device);
        if (role === "student" && theme === "dark" && device === "phone") {
          const page = await context.newPage();
          for (const [from, to] of REDIRECTS) {
            await page.goto(`${BASE}${from}`);
            const got = new URL(page.url()).pathname;
            if (got !== to) problems.push(`redirect ${from}: ended on ${got}, expected ${to}`);
          }
          await page.close();
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/report.json`, JSON.stringify({ problems, pages: report }, null, 2));
console.log(`${report.length} screenshots in ${OUT}/`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("No problems found.");
}
