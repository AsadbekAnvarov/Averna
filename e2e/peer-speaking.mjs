/**
 * Peer speaking end-to-end flow (docs/peer-speaking.md): two seeded students with
 * fake media both pick "Guided conversation" and press "Find a partner", land in the
 * same /learning/speaking/room/<id>, both press "I'm ready", the round's lead
 * presses Start, both see the conversation card, the lead ends the session (with
 * the confirm dialog) and both see the done screen with the peer-feedback form.
 *
 * Whether the WebRTC call itself connects is NOT asserted: STUN may be unreachable
 * in CI. Only the session API / state machine / UI path is checked.
 *
 *   BASE_URL=http://localhost:3000 node e2e/peer-speaking.mjs
 *
 * Runs in CI after the screenshots (.github/workflows/screens.yml); the report is
 * e2e/report-peer-speaking.json, step screenshots go to screens/peer-*.png.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REPORT = process.env.REPORT ?? "e2e/report-peer-speaking.json";
const OUT = process.env.OUT_DIR ?? "screens";
mkdirSync(OUT, { recursive: true });

/** Two seeded students of the same group (prisma/seed.ts: student1-5@averna.com / student123). */
const STUDENTS = [
  { id: "s1", email: "student1@averna.com", password: "student123" },
  { id: "s2", email: "student2@averna.com", password: "student123" },
];

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/**
 * Environment noise, not app bugs: failed resource loads (409 version conflicts are
 * part of the sync protocol), network errors, and WebRTC / media / autoplay messages
 * from a headless browser without a reachable STUN server.
 */
const NOISE =
  /favicon|Failed to load resource|ERR_[A-Z_]+|net::|WebRTC|RTCPeerConnection|ICE|STUN|TURN|getUserMedia|AudioContext|NotAllowedError|play\(\) failed|autoplay/i;

const problems = [];
const notes = [];
const steps = [];

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

function watch(page, who) {
  page.on("pageerror", (e) => problems.push(`${who}: page error: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (NOISE.test(text)) {
      notes.push(`${who}: console (ignored): ${text.slice(0, 200)}`);
      return;
    }
    problems.push(`${who}: console error: ${text.slice(0, 300)}`);
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/peer-${name}.png`, fullPage: true }).catch(() => {});
}

/** Runs one named step; a failure is recorded and stops the flow (later steps depend on it). */
async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    steps.push({ step: name, ok: true, ms: Date.now() - started });
    console.log(`ok   ${name} (${Date.now() - started} ms)`);
    return true;
  } catch (e) {
    const msg = String(e?.message ?? e).split("\n")[0].slice(0, 300);
    steps.push({ step: name, ok: false, ms: Date.now() - started, error: msg });
    problems.push(`${name}: ${msg}`);
    console.log(`FAIL ${name}: ${msg}`);
    return false;
  }
}

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const users = [];
try {
  for (const s of STUDENTS) {
    const context = await browser.newContext(PHONE);
    await context.grantPermissions(["microphone"], { origin: new URL(BASE).origin });
    await context.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("averna_theme", "dark");
      localStorage.setItem("averna_onboarding_done_v1", "1");
      localStorage.setItem("averna_setup_done_v1", "1");
      localStorage.setItem("averna_seasonal", "0");
      sessionStorage.setItem("averna_pwa_dismissed", "1");
    });
    users.push({ ...s, context, page: null, roomId: null });
  }

  const ok =
    (await step("sign in both students", async () => {
      for (const u of users) {
        await signIn(u.context, u);
        u.page = await u.context.newPage();
        watch(u.page, u.id);
      }
    })) &&
    (await step("open the hub, pick Guided conversation, Find a partner (both)", async () => {
      for (const u of users) {
        await u.page.goto(`${BASE}/learning/speaking`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await u.page.getByRole("heading", { name: "Speak with a partner" }).waitFor({ timeout: 30_000 });
        await u.page.locator('input[name="peer-format"][value="conversation"]').check();
        const find = u.page.getByRole("button", { name: "Find a partner" });
        await find.waitFor({ timeout: 15_000 });
        if (!(await find.isEnabled())) throw new Error(`${u.id}: "Find a partner" is disabled`);
        await find.click();
        // The first student waits; the second is matched straight away (or waits a poll).
        if (u === users[0]) {
          await u.page.getByText(/Looking for a partner/).first().waitFor({ timeout: 15_000 });
          await shot(u.page, "hub-waiting");
        }
      }
    })) &&
    (await step("both land in the same room within 30 s", async () => {
      await Promise.all(
        users.map(async (u) => {
          await u.page.waitForURL(/\/learning\/speaking\/room\/[A-Za-z0-9_-]+$/, { timeout: 30_000 });
          u.roomId = new URL(u.page.url()).pathname.split("/").pop();
        })
      );
      if (users[0].roomId !== users[1].roomId) throw new Error(`different rooms: ${users[0].roomId} vs ${users[1].roomId}`);
      notes.push(`room ${users[0].roomId}`);
    })) &&
    (await step("lobby: both press I'm ready", async () => {
      for (const u of users) {
        const ready = u.page.getByRole("button", { name: "I'm ready" });
        await ready.waitFor({ timeout: 30_000 });
        // Disabled only while the call reports a mic problem; fake media should allow it.
        await u.page.waitForFunction(
          () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "I'm ready" && !b.disabled),
          null,
          { timeout: 20_000 }
        );
        await ready.click();
        await u.page.getByRole("button", { name: "Ready", exact: true }).waitFor({ timeout: 15_000 });
      }
      await shot(users[0].page, "lobby-ready-s1");
    })) &&
    (await step("the lead presses Start", async () => {
      // Exactly one of the two (the round's lead) gets "Start"; the other waits for them.
      const deadline = Date.now() + 20_000;
      let lead = null;
      while (!lead && Date.now() < deadline) {
        for (const u of users) {
          if (await u.page.getByRole("button", { name: "Start", exact: true }).isVisible().catch(() => false)) lead = u;
        }
        if (!lead) await users[0].page.waitForTimeout(500);
      }
      if (!lead) throw new Error('no "Start" button for either student');
      const other = users.find((u) => u !== lead);
      if (await other.page.getByRole("button", { name: "Start", exact: true }).isVisible().catch(() => false)) {
        throw new Error('both students see "Start"');
      }
      lead.lead = true;
      notes.push(`lead: ${lead.id}`);
      await lead.page.getByRole("button", { name: "Start", exact: true }).click();
    })) &&
    (await step("the conversation card is visible for both", async () => {
      for (const u of users) {
        await u.page.getByText(/^Card 1 of \d+/).first().waitFor({ timeout: 20_000 });
        await shot(u.page, `card-${u.lead ? "lead" : "partner"}`);
      }
      const lead = users.find((u) => u.lead);
      if (!(await lead.page.getByRole("button", { name: /^(Next card|Finish round)$/ }).isVisible())) {
        throw new Error('the lead has no "Next card" button');
      }
      const other = users.find((u) => !u.lead);
      if (await other.page.getByRole("button", { name: /^(Next card|Finish round)$/ }).isVisible().catch(() => false)) {
        throw new Error('the partner also has "Next card"');
      }
    })) &&
    (await step("the lead ends the session (confirm dialog)", async () => {
      const lead = users.find((u) => u.lead);
      await lead.page.getByRole("button", { name: "End session" }).first().click();
      const dialog = lead.page.getByRole("dialog");
      await dialog.waitFor({ timeout: 10_000 });
      await dialog.getByRole("button", { name: "End session" }).click();
      await dialog.waitFor({ state: "detached", timeout: 10_000 });
    })) &&
    (await step("both see the done screen and the feedback form", async () => {
      for (const u of users) {
        await u.page.getByRole("heading", { name: /^Session ended by / }).waitFor({ timeout: 20_000 });
        const form = u.page.locator('section[aria-label="Peer feedback"]');
        await form.getByRole("button", { name: "Send feedback" }).waitFor({ timeout: 20_000 });
        await shot(u.page, `done-${u.lead ? "lead" : "partner"}`);
      }
    }));
  if (!ok) {
    for (const u of users) if (u.page) await shot(u.page, `failure-${u.id}`);
  }
} catch (e) {
  problems.push(`run: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`);
} finally {
  for (const u of users) await u.context.close().catch(() => {});
  await browser.close();
}

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, JSON.stringify({ baseUrl: BASE, steps, problems, notes }, null, 2));
console.log(`Report: ${REPORT}`);
for (const n of notes) console.log(`note ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} peer-speaking problem(s):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Peer speaking flow passed.");
}
