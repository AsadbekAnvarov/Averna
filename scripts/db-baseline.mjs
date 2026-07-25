#!/usr/bin/env node
/**
 * S0b — adopt Prisma migrations on an existing database, safely.
 *
 * Cross-platform (Windows cmd / PowerShell / macOS / Linux) — run with:
 *   npm run db:baseline
 *
 * Requires DATABASE_URL in the environment. Use a Neon BRANCH first, never
 * production. Nothing is written to the database except migration bookkeeping in
 * step 3 (no schema change, no data change).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASELINE = "00000000000000_baseline";
const DRIFT = "00000000000001_sync_schema";
const MIGRATIONS = join("prisma", "migrations");
const baselineDir = join(MIGRATIONS, BASELINE);
const driftDir = join(MIGRATIONS, DRIFT);

const die = (msg) => {
  console.error(`\n[X] ${msg}\n`);
  process.exit(1);
};

/** Run the local prisma CLI cross-platform and return stdout. */
function prisma(args, { capture = false } = {}) {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  try {
    return execFileSync(cmd, ["prisma", ...args], {
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: process.env,
    });
  } catch (err) {
    if (capture) throw err;
    throw new Error(`prisma ${args[0]} failed`);
  }
}

if (!existsSync(join("prisma", "schema.prisma"))) {
  die("Run this from the project folder (the one containing package.json).");
}
if (!process.env.DATABASE_URL) {
  die(
    "DATABASE_URL is not set.\n\n" +
      "  Windows (cmd):        set DATABASE_URL=postgres://...\n" +
      "  Windows (PowerShell): $env:DATABASE_URL=\"postgres://...\"\n" +
      "  macOS / Linux:        export DATABASE_URL=\"postgres://...\"\n\n" +
      "  Use a Neon BRANCH first, not production."
  );
}

if (existsSync(baselineDir)) {
  console.log(`\n[!] ${baselineDir} already exists - the baseline was created before.`);
  console.log("    Nothing to do. To start over, delete prisma/migrations and re-run.\n");
  process.exit(0);
}

// ---------- Step 1: baseline generated FROM THE SCHEMA (no DB access) ----------
console.log("\n> Step 1/4 - generating the baseline from prisma/schema.prisma (no DB access)...");
mkdirSync(baselineDir, { recursive: true });
const baselineSql = prisma(
  ["migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { capture: true }
);
writeFileSync(join(baselineDir, "migration.sql"), baselineSql);
console.log(`  OK  ${join(baselineDir, "migration.sql")} (${baselineSql.split("\n").length} lines)`);

const lockPath = join(MIGRATIONS, "migration_lock.toml");
if (!existsSync(lockPath)) {
  writeFileSync(lockPath, 'provider = "postgresql"\n');
  console.log(`  OK  ${lockPath}`);
}

// ---------- Step 2: how the real DB differs from the schema ----------
console.log("\n> Step 2/4 - comparing the real database to the schema...");
mkdirSync(driftDir, { recursive: true });
// Read the live DB through the schema's datasource so the connection string is
// never placed on the command line (it would leak into process listings/logs).
const driftSql = prisma(
  [
    "migrate", "diff",
    "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/schema.prisma",
    "--script",
  ],
  { capture: true }
);
writeFileSync(join(driftDir, "migration.sql"), driftSql);

const statements = driftSql
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("--"));
const drops = statements.filter((l) => /^(DROP\s+(TABLE|COLUMN)|ALTER\s+TABLE\b.*\bDROP\b)/i.test(l));

if (statements.length === 0) {
  console.log("  OK  No drift - the database already matches the schema.");
  // Remove the empty migration so `migrate deploy` has nothing pointless to run.
  writeFileSync(join(driftDir, "migration.sql"), "-- no drift\n");
} else {
  console.log(`  i   ${statements.length} statement(s) of drift written to:`);
  console.log(`      ${join(driftDir, "migration.sql")}`);
  if (drops.length > 0) {
    console.log(`\n  [!!] WARNING: it contains ${drops.length} DROP statement(s):`);
    drops.slice(0, 10).forEach((d) => console.log(`       ${d.slice(0, 120)}`));
    console.log("       DO NOT apply this blindly - get it reviewed first.\n");
  }
}

// ---------- Step 3: mark the baseline as already applied ----------
console.log("\n> Step 3/4 - marking the baseline as already applied (bookkeeping only)...");
prisma(["migrate", "resolve", "--applied", BASELINE]);
console.log("  OK  baseline recorded; no tables were created or altered");

// ---------- Step 4: status ----------
console.log("\n> Step 4/4 - status:");
try {
  prisma(["migrate", "status"]);
} catch {
  /* status exits non-zero when migrations are pending - that's expected here */
}

const driftLines = readFileSync(join(driftDir, "migration.sql"), "utf8").trim();
console.log(`
------------------------------------------------------------
Next steps (manual, on purpose):

 1. ${driftLines === "-- no drift" ? "No drift migration was needed - skip to step 3." : "READ the drift file listed above."}
    - only CREATE / ADD statements  -> safe to apply
    - any DROP on a table with data -> stop, get it reviewed

 2. Apply it:
        npx prisma migrate deploy
        npm run db:status          (expect: up to date)

 3. Smoke-test against this database (sign in, submit a test, one review).

 4. Only after the above passed on a Neon BRANCH, repeat with
    DATABASE_URL pointing at production.

 5. Finally switch the deploy over in package.json:
        "vercel-build": "prisma generate && prisma migrate deploy && next build"
    and commit prisma/migrations - it must be in git.
------------------------------------------------------------
`);
