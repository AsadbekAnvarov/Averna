/**
 * Static guard: one Vercel function bundle per deployment.
 *
 * Vercel groups Next.js routes by their function config, and every distinct
 * config is a separate bundle with its own copy of the Prisma engine (~18 MB)
 * and Next runtime — multiplied by every retained deployment (Hobby "Functions
 * Storage", 10 GB). So no route sets `maxDuration`, `preferredRegion` or
 * `memory`; durations are set project-wide (vercel.json `fluid: true` → 300 s
 * default). See docs/vercel-resources.md.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PER_ROUTE_CONFIG = /^\s*export\s+(?:const|let|var|(?:async\s+)?function)\s+(maxDuration|preferredRegion|memory)\b/m;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sources(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("function config", () => {
  it("no file under app/** exports maxDuration, preferredRegion or memory", () => {
    const offenders = sources(join(ROOT, "app"))
      .map((file) => ({ file: relative(ROOT, file).split("\\").join("/"), m: readFileSync(file, "utf8").match(PER_ROUTE_CONFIG) }))
      .filter((x) => x.m)
      .map((x) => `${x.file} (${x.m![1]})`);
    expect(
      offenders,
      "Each distinct route config becomes a separate Vercel function bundle with its own Prisma engine. " +
        "Set durations project-wide in Vercel (Fluid compute: 300 s default) instead of per route.",
    ).toEqual([]);
  });

  it("vercel.json keeps Fluid compute on (the routes rely on its 300 s default) and the ignored build step", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
    expect(config.fluid).toBe(true);
    expect(config.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
  });
});
