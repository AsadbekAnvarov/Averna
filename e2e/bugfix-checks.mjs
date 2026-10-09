/**
 * Bug-condition exploration, level 2 — Property 1 of .kiro/specs/mobile-ui-exam-light-theme-fix
 * (cases 1–9 of the design, "Исследовательская проверка условия ошибки"), on real computed
 * styles in Chromium. It encodes the EXPECTED behaviour: on the unfixed code it reports
 * violations (that confirms the bugs); after the fix (task 6.2) it must report none.
 *
 *   BASE_URL=http://localhost:3000 node e2e/bugfix-checks.mjs
 *   SEED=123 SAMPLES=5 …   reproduce / widen the fast-check sampled viewport widths
 *
 * Violations go to e2e/report-bugfix.json; the exit code is 1 when there are any.
 * Runs in CI after e2e/screens.mjs (.github/workflows/screens.yml) against the seeded database.
 * Not emulated here (manual device checklist, task 8): real safe-area insets (B4), iOS < 16 (B10)
 * and a real on-screen keyboard (B7 is approximated by a 390×400 viewport).
 */
import { chromium } from "playwright";
import { createRoleSessionCache } from "./role-session.mjs";

const ensureSignedIn = createRoleSessionCache();
import fc from "fast-check";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REPORT = process.env.REPORT ?? "e2e/report-bugfix.json";
const SEED = Number.parseInt(process.env.SEED ?? "", 10) || Math.floor(Math.random() * 2 ** 31);
const SAMPLES = Number.parseInt(process.env.SAMPLES ?? "", 10) || 5;

const USERS = {
  student: { email: "student1@averna.com", password: "student123" },
  teacher: { email: "teacher@averna.com", password: "teacher123" },
};

const THEME_COLORS = { dark: "#04070d", light: "#ffffff" };
/** WCAG AA for body text, and "light surface" as in Property 1. */
const MIN_CONTRAST = 4.5;
const MIN_LUMINANCE = 0.8;
const TOUCH = 44;

const violations = [];
const notes = [];
const checked = [];

const violation = (id, label, message) => violations.push({ case: id, label, message });
const note = (id, label, message) => notes.push({ case: id, label, message });
const px = (v) => `${Math.round(v * 10) / 10}px`;

/** Runs one scenario; a crash is recorded as a violation and the other scenarios still run. */
async function step(id, label, fn) {
  try {
    await fn();
  } catch (e) {
    violation(id, label, `check crashed: ${String(e?.message ?? e).split("\n")[0]}`);
  }
}

// ---------------------------------------------------------------------------------------------
// In-page helpers (installed with addInitScript, available as window.__bf)
// ---------------------------------------------------------------------------------------------

function installHelpers() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, base) => ({
    r: top.r * top.a + base.r * (1 - top.a),
    g: top.g * top.a + base.g * (1 - top.a),
    b: top.b * top.a + base.b * (1 - top.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /** Background actually seen behind an element: its background composited over its ancestors'. */
  const bgOf = (el) => {
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const n of chain.reverse()) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) base = over(c, base);
    }
    return base;
  };
  const rgb = (c) => `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`;
  const visible = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  };
  /** Background of `el` and the contrast of the text colour of `textEl` (default `el`) on it. */
  const surface = (el, textEl) => {
    const bg = bgOf(el);
    const t = textEl || el;
    const fg = parse(getComputedStyle(t).color);
    const tbg = bgOf(t);
    return {
      bg: rgb(bg),
      luminance: Math.round(lum(bg) * 1000) / 1000,
      color: fg ? rgb(fg) : null,
      contrast: fg ? Math.round(contrast(over(fg, tbg), tbg) * 100) / 100 : null,
    };
  };
  const ownText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
  const inFixed = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return true;
    return false;
  };
  const z = (el) => Number.parseInt(getComputedStyle(el).zIndex, 10) || 0;
  /** The top-most full-viewport fixed overlay above the exam shell (z-70) and its panel: a modal. */
  const modal = () => {
    const vw = innerWidth;
    const vh = innerHeight;
    const overlays = Array.from(document.querySelectorAll("body *")).filter((el) => {
      if (getComputedStyle(el).position !== "fixed" || z(el) < 75 || !visible(el) || el.children.length === 0) return false;
      const r = el.getBoundingClientRect();
      return r.left <= 1 && r.top <= 1 && r.right >= vw - 1 && r.bottom >= vh - 1;
    });
    overlays.sort((a, b) => z(b) - z(a));
    const overlay = overlays[0];
    if (!overlay) return null;
    const panel =
      overlay.querySelector(".av-modal-panel") ||
      Array.from(overlay.children).find(
        (c) => c.getAttribute("aria-hidden") !== "true" && getComputedStyle(c).position !== "absolute" && visible(c)
      );
    if (!panel) return null;
    const st = getComputedStyle(panel);
    return {
      vh,
      ...box(panel),
      overflowY: st.overflowY,
      scrollH: panel.scrollHeight,
      clientH: panel.clientHeight,
      text: (panel.textContent || "").trim().slice(0, 50),
    };
  };
  window.__bf = { parse, lum, contrast, bgOf, rgb, visible, box, surface, ownText, inFixed, modal };
}

// ---------------------------------------------------------------------------------------------
// Browser plumbing (same sign-in and storage flags as e2e/screens.mjs)
// ---------------------------------------------------------------------------------------------

const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };

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

/** New signed-in context; `fn(context)` runs inside it and the context is always closed. */
async function withContext(browser, opts, fn) {
  const { user = "student", theme = "dark", phone = false, viewport, onboardingDone = true, storage = {} } = opts;
  const context = await browser.newContext(
    phone
      ? { ...PHONE, viewport: viewport ?? { width: 390, height: 844 } }
      : { viewport: viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  );
  try {
    await context.addInitScript(
      ({ theme, onboardingDone, storage }) => {
        localStorage.setItem("averna_theme", theme);
        if (onboardingDone) {
          localStorage.setItem("averna_onboarding_done_v1", "1");
          localStorage.setItem("averna_setup_done_v1", "1");
        }
        localStorage.setItem("averna_seasonal", "0");
        sessionStorage.setItem("averna_pwa_dismissed", "1");
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      },
      { theme, onboardingDone, storage }
    );
    await context.addInitScript(installHelpers);
    await ensureSignedIn(context, BASE, user, USERS[user], signIn);
    await fn(context);
  } catch (error) {
    // Keep navigation failures actionable without weakening the assertions.
    mkdirSync("screens", { recursive: true });
    for (const [index, page] of context.pages().entries()) {
      note("navigation-debug", user, `page ${index}: ${page.url()}`);
      await page.screenshot({ path: `screens/bugfix-failure-${user}-${index}.png`, fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    await context.close();
  }
}

async function open(context, path) {
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  return page;
}

/** Opens the first Reading/Listening practice test from its library. Close with page.close() (skips the leave guard). */
async function openExam(context, skill, id, label) {
  const page = await open(context, `/learning/${skill}`);
  const href = await page.evaluate((skill) => {
    const links = Array.from(document.querySelectorAll(`a[href^="/learning/${skill}/"]`)).map((a) => a.getAttribute("href"));
    return links.find((h) => h && !/\/result(\/|$|\?)/.test(h)) ?? null;
  }, skill);
  if (!href) {
    violation(id, label, `setup: no ${skill} test link on /learning/${skill}`);
    await page.close();
    return null;
  }
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('.exam-shell nav[aria-label="Question navigator"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  return page;
}

/** Property 1 (A1/A2): a light surface (luminance ≥ 0.8) with readable text (≥ 4.5:1). */
function checkSurface(id, label, name, s) {
  if (!s) return;
  if (s.luminance < MIN_LUMINANCE) {
    violation(id, label, `${name}: background ${s.bg} (luminance ${s.luminance}, expected ≥ ${MIN_LUMINANCE})`);
  }
  if (s.contrast != null && s.contrast < MIN_CONTRAST) {
    violation(id, label, `${name}: text ${s.color} on ${s.bg} has contrast ${s.contrast}:1 (expected ≥ ${MIN_CONTRAST}:1)`);
  }
}

// ---------------------------------------------------------------------------------------------
// Case 1 — light Reading / Listening (A1)
// ---------------------------------------------------------------------------------------------

/** <html> class and the colours of the exam root, header, navigator, audio panel, text and a field. */
const examColours = (page) =>
  page.evaluate(() => {
    const bf = window.__bf;
    const root = document.querySelector(".exam-shell");
    const header = root.querySelector("header");
    const nav = root.querySelector('nav[aria-label="Question navigator"]');
    const body = root.querySelector(':scope > div[style*="font-size"]');
    const footer = nav.previousElementSibling && nav.previousElementSibling !== body ? nav.previousElementSibling : null;
    const title = header.querySelector("p");
    const text = Array.from(root.querySelectorAll("p, span, label, li, h1, h2, h3, h4")).find(
      (el) => bf.visible(el) && !el.closest("header, nav") && bf.ownText(el) && (el.textContent || "").trim().length > 20
    );
    const field = Array.from(root.querySelectorAll('input[type="text"], select, textarea')).find(bf.visible);
    return {
      html: document.documentElement.className,
      surfaces: {
        ".exam-shell": bf.surface(root),
        header: bf.surface(header, title),
        navigator: bf.surface(nav, nav.querySelector("button")),
        "audio/footer panel": footer ? bf.surface(footer) : null,
        "passage/question text": text ? bf.surface(text) : null,
        "answer field": field ? bf.surface(field) : null,
      },
    };
  });

async function caseLightExam(browser) {
  const id = "1-light-exam";
  await withContext(browser, { theme: "light" }, async (context) => {
    for (const skill of ["reading", "listening"]) {
      const label = `light/desktop/${skill}`;
      await step(id, label, async () => {
        const page = await openExam(context, skill, id, label);
        if (!page) return;
        const r = await examColours(page);
        const cls = r.html.split(/\s+/);
        if (!cls.includes("light") || cls.includes("dark")) violation(id, label, `<html> class is "${r.html}" (expected light kept)`);
        for (const [name, s] of Object.entries(r.surfaces)) checkSurface(id, label, name, s);
        await page.close();
      });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Case 2 — dictionary on /article in the light theme (A2)
// ---------------------------------------------------------------------------------------------

async function caseDictionary(browser) {
  const id = "2-dictionary";
  const label = "light/desktop/article";
  await withContext(browser, { theme: "light" }, async (context) => {
    const page = await open(context, "/article");
    const word = await page.evaluate(() => {
      const p = document.querySelector("p.whitespace-pre-line") || document.querySelector("[data-lookup-text]");
      if (!p) return null;
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const m = /[A-Za-z]{4,}/.exec(node.textContent || "");
        if (!m) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return m[0];
      }
      return null;
    });
    if (!word) {
      violation(id, label, "setup: no article text to select");
      return;
    }
    const chip = page.locator('button[aria-label^="Look up"]').first();
    await chip.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(300);
    checkSurface(id, label, `"Look up" chip (${word})`, await chip.evaluate((b) => window.__bf.surface(b.parentElement, b)));
    await chip.click();
    const pop = page.locator("[data-dictionary-popover]").first();
    await pop.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(600);
    checkSurface(id, label, "dictionary popover", await pop.evaluate((el) => window.__bf.surface(el)));
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 3 — the visible pane fills the exam body below lg (B1)
// ---------------------------------------------------------------------------------------------

const measurePanes = (page) =>
  page.evaluate(() => {
    const sep = document.querySelector('.exam-shell [role="separator"]');
    if (!sep) return null;
    const body = sep.parentElement;
    const shown = Array.from(body.children).filter((el) => el !== sep && getComputedStyle(el).display !== "none");
    return {
      body: body.getBoundingClientRect().width,
      shown: shown.map((el) => ({ width: el.getBoundingClientRect().width, flexBasis: getComputedStyle(el).flexBasis })),
    };
  });

function checkPanes(id, label, m) {
  if (!m) return violation(id, label, "setup: no two-pane exam body (separator) found");
  if (m.shown.length !== 1) {
    return violation(id, label, `${m.shown.length} panes visible below lg (expected 1): ${JSON.stringify(m.shown)}`);
  }
  const [p] = m.shown;
  if (Math.abs(p.width - m.body) > 1) {
    violation(id, label, `visible pane ${px(p.width)} of ${px(m.body)} body (flex-basis ${p.flexBasis}), expected 100% ±1px`);
  }
}

async function tab(page, i) {
  await page.locator('.exam-shell [role="tablist"] [role="tab"]').nth(i).click();
  await page.waitForTimeout(150);
}

async function casePaneWidth(browser) {
  const id = "3-pane-width";
  await withContext(browser, {}, async (context) => {
    const page = await openExam(context, "reading", id, "reading");
    if (!page) return;
    const sampled = fc.sample(fc.integer({ min: 320, max: 1023 }), { numRuns: SAMPLES, seed: SEED });
    for (const w of [768, 900, ...sampled]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(200);
      await tab(page, 0);
      checkPanes(id, `${w}px/Passage tab`, await measurePanes(page));
      await tab(page, 1);
      checkPanes(id, `${w}px/Questions tab`, await measurePanes(page));
      await tab(page, 0);
      await page.locator('.exam-shell nav button[aria-label^="Question "]').first().click();
      await page.waitForTimeout(150);
      checkPanes(id, `${w}px/after navigator jump`, await measurePanes(page));
    }

    // Divider dragged to 30% on desktop, then the window narrowed to 900 px.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    const sep = await page.locator('.exam-shell [role="separator"]').boundingBox();
    const body = await page.evaluate(() => {
      const r = document.querySelector('.exam-shell [role="separator"]').parentElement.getBoundingClientRect();
      return { x: r.left, w: r.width };
    });
    if (!sep) return violation(id, "split=30", "setup: divider not visible at 1440px");
    const y = sep.y + sep.height / 2;
    await page.mouse.move(sep.x + sep.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(body.x + body.w * 0.3, y, { steps: 8 });
    await page.mouse.up();
    const left = await page.evaluate(() => {
      const s = document.querySelector('.exam-shell [role="separator"]');
      return s.previousElementSibling.getBoundingClientRect().width / s.parentElement.getBoundingClientRect().width;
    });
    if (Math.abs(left - 0.3) > 0.02) note(id, "split=30", `setup: drag gave a ${Math.round(left * 100)}% left pane`);
    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(200);
    checkPanes(id, "split=30 → 900px", await measurePanes(page));
    await tab(page, 1);
    checkPanes(id, "split=30 → 900px/Questions tab", await measurePanes(page));
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 4 — the exam header on phones (B2, B3)
// ---------------------------------------------------------------------------------------------

async function casePhoneHeader(browser) {
  const id = "4-phone-header";
  await withContext(browser, { phone: true }, async (context) => {
    const page = await openExam(context, "reading", id, "reading");
    if (!page) return;
    const sampled = fc.sample(fc.integer({ min: 320, max: 639 }), { numRuns: SAMPLES, seed: SEED + 1 });
    for (const w of [390, 320, ...sampled]) {
      const label = `practice/${w}px`;
      await page.setViewportSize({ width: w, height: 844 });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const bf = window.__bf;
        const root = document.querySelector(".exam-shell");
        const header = root.querySelector("header");
        const nav = root.querySelector('nav[aria-label="Question navigator"]');
        const info = (el) => (el && bf.visible(el) ? { ...bf.box(el), scrollW: el.scrollWidth, clientW: el.clientWidth } : null);
        const items = Array.from(header.children)
          .filter((el) => bf.visible(el) && getComputedStyle(el).position !== "absolute")
          .map((el) => ({
            name: el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 20) || el.tagName.toLowerCase(),
            ...bf.box(el),
          }));
        return {
          vw: innerWidth,
          exit: info(root.querySelector('a[aria-label="Leave the test"]')),
          textSize: info(root.querySelector('button[aria-label="Text size"]')),
          timer: info(header.querySelector('[aria-label^="Time remaining"]')),
          finish: info(Array.from(header.querySelectorAll("button")).find((b) => /finish|submit/i.test(b.textContent || ""))),
          prev: info(nav.querySelector('button[aria-label="Previous question"]')),
          next: info(nav.querySelector('button[aria-label="Next question"]')),
          numbers: Array.from(nav.querySelectorAll('button[aria-label^="Question "]')).filter(bf.visible).map((b) => b.getBoundingClientRect().height),
          items,
        };
      });
      const target = (name, b) => {
        if (!b) return violation(id, label, `${name} is not shown`);
        if (b.w < TOUCH - 0.5 || b.h < TOUCH - 0.5) violation(id, label, `${name} is ${px(b.w)}×${px(b.h)} (expected ≥ 44×44)`);
      };
      target("exit link", r.exit);
      target('"Aa" text-size button', r.textSize);
      target("previous-question button", r.prev);
      target("next-question button", r.next);
      const low = r.numbers.filter((h) => h < 40 - 0.5);
      if (low.length) violation(id, label, `${low.length} question-number buttons are ${px(Math.min(...low))} high (expected ≥ 40px)`);
      for (const [name, b] of [["timer", r.timer], ["finish button", r.finish]]) {
        if (!b) {
          violation(id, label, `${name} is not shown`);
          continue;
        }
        if (b.scrollW > b.clientW + 1) violation(id, label, `${name} is clipped (${b.scrollW}px content in ${b.clientW}px)`);
      }
      for (const it of r.items) {
        if (it.x < -0.5 || it.right > r.vw + 0.5) violation(id, label, `header item "${it.name}" spans ${px(it.x)}–${px(it.right)} outside the ${r.vw}px screen`);
      }
      for (let i = 0; i < r.items.length; i++) {
        for (let j = i + 1; j < r.items.length; j++) {
          const a = r.items[i];
          const b = r.items[j];
          const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
          if (ox > 1 && oy > 1) violation(id, label, `header items "${a.name}" and "${b.name}" overlap by ${px(ox)}`);
        }
      }
    }
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 5 — viewport-fit=cover and theme-color (B4, B9)
// ---------------------------------------------------------------------------------------------

async function caseThemeColor(browser) {
  const id = "5-viewport-theme-color";
  await withContext(browser, { theme: "light", phone: true }, async (context) => {
    const page = await open(context, "/dashboard");
    const vp = (await page.getAttribute('meta[name="viewport"]', "content")) ?? "";
    if (!/viewport-fit\s*=\s*cover/.test(vp)) violation(id, "meta viewport", `content is "${vp}" (expected viewport-fit=cover)`);

    const expectColor = async (label, mode) => {
      const colors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => (m.getAttribute("content") || "").toLowerCase())
      );
      if (!colors.length) return violation(id, label, "no meta[name=theme-color]");
      const wrong = colors.filter((c) => c !== THEME_COLORS[mode]);
      if (wrong.length) violation(id, label, `theme-color is ${colors.join(", ")} (expected ${THEME_COLORS[mode]} for ${mode})`);
    };
    await expectColor("light theme after load", "light");

    // Toggle twice through the command palette's theme action (no reload).
    for (const mode of ["dark", "light"]) {
      await page.evaluate(() => window.dispatchEvent(new Event("averna-command-palette")));
      await page.locator('input[placeholder="Search pages & actions…"]').fill("theme");
      await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).first().click();
      await page.waitForFunction((m) => document.documentElement.classList.contains(m), mode, { timeout: 5_000 });
      await page.waitForTimeout(150);
      await expectColor(`after switching to ${mode}`, mode);
    }
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 6 — /messages for a teacher on 375×667 (B5)
// ---------------------------------------------------------------------------------------------

async function caseMessages(browser) {
  const id = "6-messages";
  const label = "teacher/375x667";
  await withContext(browser, { user: "teacher", phone: true, viewport: { width: 375, height: 667 } }, async (context) => {
    const page = await open(context, "/messages");
    const contacts = await page.evaluate(() =>
      Array.from(new Set(Array.from(document.querySelectorAll('a[href^="/messages?with="]')).map((a) => a.getAttribute("href"))))
    );
    if (!contacts.length) {
      violation(id, label, "setup: the teacher has no contacts on /messages");
      return;
    }
    if (contacts.length < 2) note(id, label, `only ${contacts.length} contact: the "All contacts" link is not expected`);
    await page.goto(`${BASE}${contacts[0]}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const bf = window.__bf;
      const input = document.querySelector('input[placeholder="Type a message..."]');
      const bar = document.querySelector('nav[aria-label="Primary"]');
      const barTop = bar && bf.visible(bar) ? bar.getBoundingClientRect().top : innerHeight;
      const back = Array.from(document.querySelectorAll('a[href="/messages"]')).find(
        (a) => bf.visible(a) && /all contacts|barcha kontaktlar/i.test(a.textContent || "")
      );
      return { vh: innerHeight, limit: Math.min(innerHeight, barTop), input: bf.visible(input) ? bf.box(input) : null, back: back ? bf.box(back) : null };
    });
    if (!r.input) violation(id, label, "message input is not shown in the thread view");
    else if (r.input.bottom > r.limit + 0.5) {
      violation(id, label, `message input ends at ${px(r.input.bottom)}, below the first screen (${px(r.limit)}: top of the tab bar / ${r.vh}px viewport)`);
    }
    if (contacts.length > 1) {
      if (!r.back) violation(id, label, 'no visible "All contacts" link back to the contact list');
      else if (r.back.h < TOUCH - 0.5) violation(id, label, `"All contacts" link is ${px(r.back.h)} high (expected ≥ 44px)`);
    }
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 7 — modals on 375×667 (B6)
// ---------------------------------------------------------------------------------------------

async function checkModal(page, id, label) {
  await page.waitForTimeout(700); // entrance animation
  const m = await page.evaluate(() => window.__bf.modal());
  if (!m) return violation(id, label, "setup: modal not found");
  if (m.h > m.vh + 0.5 || m.y < -0.5 || m.bottom > m.vh + 0.5) {
    violation(id, label, `panel ${px(m.h)} high spans ${px(m.y)}–${px(m.bottom)} in a ${m.vh}px viewport`);
  }
  if (!["auto", "scroll"].includes(m.overflowY)) {
    violation(id, label, `panel overflow-y is "${m.overflowY}" (expected auto/scroll; content ${m.scrollH}px in ${m.clientH}px)`);
  }
}

async function caseModals(browser) {
  const id = "7-modals";
  const viewport = { width: 375, height: 667 };

  const shows = (locator, timeout) =>
    locator
      .waitFor({ state: "visible", timeout })
      .then(() => true)
      .catch(() => false);

  // Welcome tour, then the setup wizard (both flags cleared).
  await step(id, "onboarding tour / wizard", () =>
    withContext(browser, { phone: true, viewport, onboardingDone: false }, async (context) => {
      const page = await open(context, "/dashboard");
      const skip = page.locator('button[aria-label="Skip"]').first();
      if (!(await shows(skip, 10_000))) {
        violation(id, "onboarding tour", "setup: the tour did not open with averna_onboarding_done_v1 cleared");
        return;
      }
      await checkModal(page, id, "onboarding tour");
      await skip.click();
      await page.waitForTimeout(3_000); // the wizard asks /api/profile first
      if (await page.evaluate(() => window.__bf.modal())) await checkModal(page, id, "onboarding wizard");
      else note(id, "onboarding wizard", "not shown: the seeded student already has a goal / target band");
      await page.close();
    })
  );

  // Dashboard comfort settings.
  await step(id, "dashboard preferences", () =>
    withContext(browser, { phone: true, viewport }, async (context) => {
      const page = await open(context, "/dashboard");
      const btn = page.locator('button[title="Comfort settings"]').first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await checkModal(page, id, "dashboard preferences");
      await page.close();
    })
  );

  // Level-up celebration (a seen level of 0 makes the current level "new").
  await step(id, "level-up celebration", () =>
    withContext(browser, { phone: true, viewport, storage: { averna_seen_level: "0" } }, async (context) => {
      const page = await open(context, "/dashboard");
      if (await shows(page.locator('[role="dialog"][aria-label="Level up"]'), 8_000)) {
        await checkModal(page, id, "level-up celebration");
      } else {
        note(id, "level-up celebration", "not shown for the seeded student");
      }
      await page.close();
    })
  );

  // "Ready to submit?" in a Reading practice test.
  await step(id, "exam review dialog", () =>
    withContext(browser, { phone: true, viewport }, async (context) => {
      const page = await openExam(context, "reading", id, "exam review dialog");
      if (!page) return;
      await page.locator(".exam-shell header button", { hasText: /Finish|Submit/ }).first().click();
      await page.locator('[role="dialog"][aria-labelledby="review-title"]').waitFor({ state: "visible", timeout: 5_000 });
      await checkModal(page, id, "exam review dialog");
      await page.close();
    })
  );
}

// ---------------------------------------------------------------------------------------------
// Case 8 — command palette on 390×400 (B7; stands in for an open keyboard)
// ---------------------------------------------------------------------------------------------

async function casePalette(browser) {
  const id = "8-command-palette";
  const label = "student/390x400";
  await withContext(browser, { phone: true, viewport: { width: 390, height: 400 } }, async (context) => {
    const page = await open(context, "/dashboard");
    // The top bar's search button (the way a phone user opens it).
    await page.locator('button[aria-label="Search"]:visible').first().click();
    const input = page.locator('input[placeholder="Search pages & actions…"]');
    await input.waitFor({ state: "visible", timeout: 5_000 });
    await page.waitForTimeout(400);
    const r = await input.evaluate((el) => {
      const bf = window.__bf;
      const panel = el.closest(".max-w-lg") || el.parentElement.parentElement;
      const list = Array.from(panel.querySelectorAll("div")).find((d) => ["auto", "scroll"].includes(getComputedStyle(d).overflowY));
      const vv = window.visualViewport;
      return {
        limit: vv ? vv.offsetTop + vv.height : innerHeight,
        input: bf.box(el),
        panel: bf.box(panel),
        list: list ? bf.box(list) : null,
      };
    });
    if (r.input.bottom > r.limit + 0.5) violation(id, label, `search field ends at ${px(r.input.bottom)} below the ${px(r.limit)} visual viewport`);
    if (!r.list) violation(id, label, "no scrollable result list");
    else if (r.list.bottom > r.limit + 0.5) violation(id, label, `result list ends at ${px(r.list.bottom)} below the ${px(r.limit)} visual viewport`);
    if (r.panel.bottom > r.limit + 0.5) violation(id, label, `palette panel ends at ${px(r.panel.bottom)} below the ${px(r.limit)} visual viewport`);
    await page.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Case 9 — student and teacher calendars on 390 px (B11)
// ---------------------------------------------------------------------------------------------

/** In-page: the calendar card (the one with the "Month YYYY" title), else the page. */
function installCalendarScope() {
  window.__calendar = () => {
    const page = document.querySelector(".premium-gradient") || document.body;
    const title = Array.from(page.querySelectorAll("span, h2, h3, div")).find((el) =>
      /^[A-Z][a-z]+ \d{4}$/.test((el.textContent || "").trim())
    );
    return (title && title.closest(".glass")) || page;
  };
}

async function caseCalendar(browser) {
  const id = "9-calendar";
  for (const [user, path] of [
    ["student", "/calendar"],
    ["teacher", "/teacher/calendar"],
  ]) {
    const label = `${user}${path}/390px`;
    await step(id, label, () =>
      withContext(browser, { user, phone: true, viewport: { width: 700, height: 900 } }, (context) =>
        checkCalendar(context, id, label, path)
      )
    );
  }
}

async function checkCalendar(context, id, label, path) {
  await context.addInitScript(installCalendarScope);
  const page = await open(context, path);
  // Full names from the sm+ grid (kept unchanged by the fix): today they live only in `title` tooltips.
  const days = await page.evaluate(() => {
    const out = {};
    for (const tip of window.__calendar().querySelectorAll("[title]")) {
      const cell = tip.closest(".grid-cols-7 > *");
      if (!cell || !window.__bf.visible(tip)) continue;
      const day = Number.parseInt(cell.firstElementChild?.textContent ?? "", 10);
      if (!day) continue;
      const names = (tip.getAttribute("title") || "").split(", ").map((s) => s.trim()).filter(Boolean);
      out[day] = [...(out[day] ?? []), ...names];
    }
    return out;
  });

  // Labels in the month view on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => {
    const bf = window.__bf;
    const out = [];
    for (const el of window.__calendar().querySelectorAll("*")) {
      if (!bf.visible(el) || !bf.ownText(el) || bf.inFixed(el)) continue;
      const fs = Number.parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) out.push(`“${(el.textContent || "").trim().slice(0, 24)}” ${fs}px`);
    }
    return out;
  });
  if (small.length) violation(id, label, `${small.length} labels below 11px, e.g. ${small.slice(0, 4).join("; ")}`);

  // Tapping the busiest day shows every full name.
  const entries = Object.entries(days).sort((a, b) => b[1].length - a[1].length);
  if (!entries.length) note(id, label, "no day with named lessons / homework in this month");
  const day = entries.length ? Number(entries[0][0]) : 1;
  const names = entries.length ? entries[0][1] : [];
  const cell = await page.evaluate((day) => {
    const a = Array.from(document.querySelectorAll('a[href*="d="]')).find((el) => {
      try {
        return new URL(el.href).searchParams.get("d") === String(day) && window.__bf.visible(el);
      } catch {
        return false;
      }
    });
    if (!a) return null;
    a.setAttribute("data-bf-day", "");
    return window.__bf.box(a);
  }, day);
  if (!cell) {
    violation(id, label, `day ${day} can't be tapped: no visible ?d=${day} link (full names only in title tooltips)`);
  } else {
    if (cell.h < TOUCH - 0.5) violation(id, label, `day cell is ${px(cell.h)} high (expected ≥ 44px)`);
    try {
      await Promise.all([
        page.waitForURL((u) => u.searchParams.get("d") === String(day), { timeout: 15_000 }),
        page.locator("[data-bf-day]").tap(),
      ]);
    } catch (error) {
      const target = await page.locator("[data-bf-day]").getAttribute("href").catch(() => null);
      throw new Error(`calendar tap did not reach day ${day}; current=${page.url()}; target=${target}; ${error.message}`);
    }
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => (document.querySelector(".premium-gradient") || document.body).innerText);
    const missing = names.filter((n) => !text.includes(n));
    if (missing.length) violation(id, label, `day ${day} panel misses ${missing.map((n) => `“${n}”`).join(", ")}`);
  }
  await page.close();
}

// ---------------------------------------------------------------------------------------------

const CASES = [
  ["1-light-exam", caseLightExam],
  ["2-dictionary", caseDictionary],
  ["3-pane-width", casePaneWidth],
  ["4-phone-header", casePhoneHeader],
  ["5-viewport-theme-color", caseThemeColor],
  ["6-messages", caseMessages],
  ["7-modals", caseModals],
  ["8-command-palette", casePalette],
  ["9-calendar", caseCalendar],
];

const browser = await chromium.launch();
try {
  for (const [id, run] of CASES) {
    const before = violations.length;
    await step(id, "run", () => run(browser));
    checked.push({ case: id, violations: violations.length - before });
    console.log(`${id}: ${violations.length - before} violation(s)`);
  }
} finally {
  await browser.close();
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, JSON.stringify({ baseUrl: BASE, seed: SEED, samples: SAMPLES, checked, violations, notes }, null, 2));
console.log(`Report: ${REPORT} (seed ${SEED})`);
for (const n of notes) console.log(`note ${n.case} ${n.label}: ${n.message}`);
if (violations.length) {
  console.error(`\n${violations.length} violation(s):\n- ${violations.map((v) => `${v.case} ${v.label}: ${v.message}`).join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("No violations: Property 1 holds for cases 1–9.");
}
