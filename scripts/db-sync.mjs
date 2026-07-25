#!/usr/bin/env node
/**
 * Applies the Prisma schema during deploys, with diagnostics for connectivity
 * failures.
 *
 * Why this exists: `prisma db push` was called directly from `vercel-build`, so a
 * serverless Postgres that was merely asleep produced a bare "Error: P1001" and a
 * failed deploy with no hint about which host it tried or what to fix. Two things
 * are handled here:
 *
 *   1. Cold starts — a suspended Neon/serverless branch refuses the first
 *      connection while it wakes up. We retry with backoff instead of failing.
 *   2. Pooled connections — DDL through a connection pooler is unreliable. If a
 *      direct (unpooled) URL is available we use it for the push only; the app
 *      keeps using the pooled URL at runtime.
 *
 * What this deliberately does NOT do: swallow the error. If the schema could not
 * be applied we exit non-zero, because deploying code that expects tables which
 * were never created turns a loud build failure into a silent runtime one.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ATTEMPTS = 3;
const BACKOFF_MS = [3000, 8000];

/** Hide credentials but keep the host/database visible — that's what you debug with. */
function describeUrl(raw) {
  try {
    const u = new URL(raw);
    const db = u.pathname.replace(/^\//, "") || "(none)";
    return `${u.protocol}//${u.username ? "***:***@" : ""}${u.host}/${db}${u.search ? " " + u.search : ""}`;
  } catch {
    return "(unparseable URL)";
  }
}

const runtimeUrl = process.env.DATABASE_URL;
if (!runtimeUrl) {
  console.error("\n[db-sync] DATABASE_URL is not set.");
  console.error("[db-sync] On Vercel: Project → Settings → Environment Variables.");
  console.error("[db-sync] Make sure it is enabled for the environment being built.\n");
  process.exit(1);
}

// Neon's Vercel integration exposes an unpooled URL; some setups name it DIRECT_URL.
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || null;
const pushUrl = directUrl ?? runtimeUrl;
const isPooled = /-pooler\.|pgbouncer=true/.test(pushUrl);

console.log(`[db-sync] runtime target : ${describeUrl(runtimeUrl)}`);
if (directUrl) console.log(`[db-sync] schema target  : ${describeUrl(directUrl)} (direct)`);
if (isPooled && !directUrl) {
  console.log("[db-sync] note: URL looks pooled. If this fails, set DIRECT_URL to the unpooled");
  console.log("[db-sync]       connection string — poolers often reject schema changes.");
}

// Prefer the installed CLI over `npx`, which would otherwise hit the registry on
// every attempt — slow on Vercel and a second way for the step to fail.
const localBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const useLocal = existsSync(localBin);
const [cmd, baseArgs] = useLocal
  ? [localBin, []]
  : [process.platform === "win32" ? "npx.cmd" : "npx", ["prisma"]];

function attemptPush(n) {
  console.log(`[db-sync] applying schema (attempt ${n}/${ATTEMPTS})…`);
  const result = spawnSync(cmd, [...baseArgs, "db", "push", "--skip-generate"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: pushUrl },
  });
  if (result.error) {
    console.error(`[db-sync] could not run prisma: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

let status = 1;
for (let i = 1; i <= ATTEMPTS; i++) {
  status = attemptPush(i);
  if (status === 0) break;
  if (i < ATTEMPTS) {
    const wait = BACKOFF_MS[i - 1] ?? 8000;
    console.log(`[db-sync] failed — retrying in ${wait / 1000}s (serverless databases can be asleep)`);
    // Busy-free sleep without extra deps.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
}

if (status === 0) {
  console.log("[db-sync] schema is in sync.");
  process.exit(0);
}

console.error("\n[db-sync] ── schema could not be applied ──────────────────────────");
console.error("[db-sync] The build is stopped on purpose: your code expects tables that");
console.error("[db-sync] may not exist yet. No data was changed by this failure.");
console.error("[db-sync]");
console.error("[db-sync] If the log above shows P1001 (server unreachable), check in order:");
console.error("[db-sync]   1. Is the database project still active, and not suspended/deleted?");
console.error("[db-sync]   2. Does DATABASE_URL on Vercel point at a branch that still exists?");
console.error("[db-sync]      (a deleted database branch gives exactly this error)");
console.error("[db-sync]   3. Was the URL copied whole, including ?sslmode=require ?");
console.error("[db-sync]   4. Pooled URL? Set DIRECT_URL to the unpooled connection string.");
console.error("[db-sync]   5. Host shown above — is it the one you expect for this environment?");
console.error("[db-sync] ─────────────────────────────────────────────────────────────\n");
process.exit(status);
