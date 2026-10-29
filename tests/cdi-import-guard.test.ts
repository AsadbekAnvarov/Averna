// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convertSource } from "@/lib/cdi-import/pipeline";
import { outsideRepo } from "@/lib/cdi-import/paths";
import { readingSource } from "./fixtures/cdi-v10/build";

function files(dir: string, ext = /\.(ts|tsx|mjs|cjs|js)$/): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" || f.startsWith(".") ? [] : files(p, ext);
    return ext.test(f) ? [p] : [];
  });
}

/** Runtime imports (type-only imports are erased and never load). */
function runtimeImports(src: string): string[] {
  return Array.from(src.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)).map((m) => m[1])
    .concat(Array.from(src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)).map((m) => m[1]))
    .concat(Array.from(src.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)).map((m) => m[1]));
}

const IMPORTER = files("lib/cdi-import");

describe("the importer stays offline and never executes the source", () => {
  it("has no eval, new Function, vm or child_process in lib/cdi-import", () => {
    for (const f of IMPORTER) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/\beval\s*\(|new Function\s*\(|from ["'](?:node:)?vm["']|child_process/);
    }
  });

  it("imports no app runtime (@/, next, react, @prisma/client)", () => {
    for (const f of [...IMPORTER, "scripts/cdi-v10/import.ts"]) {
      for (const spec of runtimeImports(readFileSync(f, "utf8"))) {
        expect(spec, `${f} imports ${spec}`).not.toMatch(/^@\/|^next(\/|$)|^react(\/|$)|^@prisma\/client$/);
      }
    }
  });

  it("is imported by nothing in app/, components/ or the rest of lib/", () => {
    const users = [...files("app"), ...files("components"), ...files("lib").filter((f) => !f.replace(/\\/g, "/").includes("lib/cdi-import/"))];
    for (const f of users) expect(readFileSync(f, "utf8"), f).not.toMatch(/cdi-import/);
  });

  it("parses a source script with a side effect without running it", async () => {
    (globalThis as Record<string, unknown>).__executed = false;
    const r = await convertSource({ file: "Volume 10 test 1 reading.html", bytes: new TextEncoder().encode(readingSource(1).html), mediaBase: "https://e.github.io/x/" });
    expect(r.included).toBe(true);
    expect((globalThis as Record<string, unknown>).__executed).toBe(false);
  });

  it("refuses an output folder inside the repository (17.7)", () => {
    expect(outsideRepo(join(process.cwd(), "out"), process.cwd())).toBe(false);
    expect(outsideRepo(process.cwd(), process.cwd())).toBe(false);
    expect(outsideRepo(join(process.cwd(), "..", "averna-private"), process.cwd())).toBe(true);
    expect(readFileSync("scripts/cdi-v10/import.ts", "utf8")).toContain("outsideRepo(out, REPO_ROOT)");
  });

  it("pins the importer's dev dependencies exactly and keeps them out of dependencies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const [name, v] of [["acorn", "8.17.0"], ["parse5", "7.3.0"], ["mpg123-decoder", "1.0.3"]]) {
      expect(pkg.devDependencies[name]).toBe(v);
      expect(pkg.dependencies[name]).toBeUndefined();
    }
  });
});
