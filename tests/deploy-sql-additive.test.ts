import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// prisma/sql/deploy.sql runs on EVERY Vercel build (`npm run vercel-build`) against
// that deployment's DATABASE_URL. A preview can share the production database while
// the current production code is still running on it, so every statement must be
// additive and idempotent, and every column added to an existing table must be
// nullable or have a DEFAULT (old code inserts rows without the new columns).

const SQL = readFileSync(join(process.cwd(), "prisma", "sql", "deploy.sql"), "utf8");

/** Statements without `--` comments; `DO $$ … $$;` blocks stay one statement. */
function statements(sql: string): string[] {
  const noComments = sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const out: string[] = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < noComments.length; i++) {
    if (noComments.startsWith("$$", i)) {
      inDollar = !inDollar;
      current += "$$";
      i++;
      continue;
    }
    const ch = noComments[i];
    if (ch === ";" && !inDollar) {
      if (current.trim()) out.push(current.replace(/\s+/g, " ").trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.replace(/\s+/g, " ").trim());
  return out;
}

/**
 * Unique indexes on a table this file does NOT create. Each one must be explicitly
 * reviewed: existing rows could violate a new unique index and fail every build.
 * (`speaking_queue_studentId_key` is on a table the file creates for fresh databases;
 * on live databases the same-named index already exists — `studentId @unique` has been
 * in schema.prisma since the model was added — so the statement is a no-op there.)
 */
const UNIQUE_ON_EXISTING_TABLE_ALLOWLIST = new Set([
  // New NULLABLE column added just above it; a unique index allows any number of NULLs.
  "users_username_key",
]);

const all = statements(SQL);

describe("prisma/sql/deploy.sql is additive and idempotent", () => {
  it("parses into statements", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it("never drops, renames, truncates, deletes, updates or changes a column", () => {
    const bad = all.filter(
      (s) =>
        /\bDROP\b/i.test(s) ||
        /\bRENAME\b/i.test(s) ||
        /\bTRUNCATE\b/i.test(s) ||
        /\bDELETE\s+FROM\b/i.test(s) ||
        /^UPDATE\b/i.test(s) ||
        /\bALTER\s+COLUMN\b/i.test(s) ||
        /\bSET\s+NOT\s+NULL\b/i.test(s) ||
        /\bSET\s+DATA\s+TYPE\b/i.test(s),
    );
    expect(bad).toEqual([]);
  });

  it("creates tables and indexes only IF NOT EXISTS", () => {
    const bad = all.filter(
      (s) =>
        /^CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\b/i.test(s) &&
        !/^CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\b/i.test(s),
    );
    expect(bad).toEqual([]);
  });

  it("adds columns only IF NOT EXISTS and never NOT NULL without a DEFAULT", () => {
    const bad: string[] = [];
    for (const s of all) {
      if (!/^ALTER\s+TABLE\b/i.test(s) || !/\bADD\s+COLUMN\b/i.test(s)) continue;
      // One ALTER TABLE may carry several comma-separated ADD COLUMN clauses.
      for (const clause of s.split(/\bADD\s+COLUMN\b/i).slice(1)) {
        const def = clause.replace(/,\s*$/, "").trim();
        if (!/^IF\s+NOT\s+EXISTS\b/i.test(def)) bad.push(`missing IF NOT EXISTS: ${s}`);
        if (/\bNOT\s+NULL\b/i.test(def) && !/\bDEFAULT\b/i.test(def)) bad.push(`NOT NULL without DEFAULT: ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("only alters tables to add columns or (guarded) constraints", () => {
    const bad = all.filter(
      (s) => /^ALTER\s+TABLE\b/i.test(s) && !/\bADD\s+(COLUMN|CONSTRAINT)\b/i.test(s),
    );
    expect(bad).toEqual([]);
  });

  it("adds unique indexes only to tables it creates (or reviewed exceptions)", () => {
    const created = new Set(
      all
        .map((s) => /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"([^"]+)"/i.exec(s)?.[1])
        .filter((t): t is string => !!t),
    );
    const bad = all
      .map((s) => /^CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+"([^"]+)"\s+ON\s+"([^"]+)"/i.exec(s))
      .filter((m): m is RegExpExecArray => !!m)
      .filter(([, name, table]) => !created.has(table) && !UNIQUE_ON_EXISTING_TABLE_ALLOWLIST.has(name))
      .map(([, name, table]) => `${name} on ${table}`);
    expect(bad).toEqual([]);
  });

  it("peer speaking: every column added to speaking_queue / speaking_rooms is nullable or defaulted", () => {
    const added = all
      .filter((s) => /^ALTER\s+TABLE\s+"speaking_(queue|rooms)"\s+ADD\s+COLUMN/i.test(s))
      .map((s) => /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"([^"]+)"\s+(.*)$/i.exec(s))
      .filter((m): m is RegExpExecArray => !!m)
      .map(([, col, def]) => ({ col, ok: !/\bNOT\s+NULL\b/i.test(def) || /\bDEFAULT\b/i.test(def) }));
    expect(added.map((a) => a.col).sort()).toEqual(
      ["format", "format", "groupId", "lastSeenAt", "level", "level", "state", "version"].sort(),
    );
    expect(added.filter((a) => !a.ok)).toEqual([]);
  });
});
