/**
 * scripts/vercel-ignore-build.mjs — Vercel's ignored build step: production
 * always builds; previews only with "[preview]" in the commit message, without a
 * commit message (hook / CLI / redeploy) or with AVERNA_FORCE_PREVIEW=1.
 * Exit 1 = build, exit 0 = skip; any error builds (fail open).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SKIP_REASON, buildDecision, shouldBuild } from "@/scripts/vercel-ignore-build.mjs";

type Env = Record<string, string | undefined>;

describe("shouldBuild", () => {
  it.each<[string, Env, boolean]>([
    ["production, plain message", { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_MESSAGE: "fix: typo" }, true],
    ["production, no message", { VERCEL_ENV: "production" }, true],
    ["preview, plain message", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "fix: typo" }, false],
    ["preview, [preview] in the subject", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "feat: x [preview]" }, true],
    ["preview, [PREVIEW] in the body", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "feat: x\n\n- y [PREVIEW]" }, true],
    ["preview, 'preview' without brackets", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "feat: preview page" }, false],
    ["preview, [screens] only", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "test: e2e [screens]" }, false],
    ["preview, message missing (deploy hook)", { VERCEL_ENV: "preview" }, true],
    ["preview, empty message", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "" }, true],
    ["preview, whitespace message", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "  \n" }, true],
    ["preview, forced", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "fix: typo", AVERNA_FORCE_PREVIEW: "1" }, true],
    ["preview, force flag not '1'", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "fix", AVERNA_FORCE_PREVIEW: "true" }, false],
    ["no VERCEL_ENV, plain message", { VERCEL_GIT_COMMIT_MESSAGE: "fix: typo" }, false],
  ])("%s → %s", (_name, env, expected) => {
    expect(shouldBuild(env)).toBe(expected);
  });

  it("skips with the instruction to add [preview]", () => {
    expect(buildDecision({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "fix" })).toEqual({ build: false, reason: SKIP_REASON });
  });

  it("fails open: an unreadable env builds", () => {
    expect(shouldBuild(null)).toBe(true);
    const throwing = new Proxy({} as Env, {
      get() {
        throw new Error("boom");
      },
    });
    expect(buildDecision(throwing)).toMatchObject({ build: true });
  });

  it("property: production always builds; otherwise iff [preview] (any case), no message, or the force flag", () => {
    const tag = fc.constantFrom("[preview]", "[PREVIEW]", "[Preview]", "[pReViEw]");
    const nearMiss = fc.constantFrom("preview", "[preview", "preview]", "[pre view]", "[previews]", "[screens]");
    const message = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc.string({ unit: "binary", maxLength: 20 }),
      fc.tuple(fc.string({ maxLength: 20 }), fc.oneof(tag, nearMiss), fc.string({ maxLength: 20 })).map((p) => p.join("")),
    );
    const env = fc.record(
      {
        VERCEL_ENV: fc.constantFrom("production", "preview", "development", ""),
        VERCEL_GIT_COMMIT_MESSAGE: message,
        AVERNA_FORCE_PREVIEW: fc.constantFrom("1", "0", "true", ""),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(env, (e) => {
        const msg = e.VERCEL_GIT_COMMIT_MESSAGE;
        const expected =
          e.VERCEL_ENV === "production" ||
          msg === undefined ||
          msg.trim() === "" ||
          msg.toLowerCase().includes("[preview]") ||
          e.AVERNA_FORCE_PREVIEW === "1";
        expect(shouldBuild(e)).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });
});

describe("CLI exit codes (Vercel: 1 = build, 0 = skip)", () => {
  const script = join(process.cwd(), "scripts", "vercel-ignore-build.mjs");
  // Only the given variables (plus what Windows needs), so the runner's own VERCEL_* never leak in.
  const run = (env: Env) => {
    const childEnv: NodeJS.ProcessEnv = { NODE_ENV: "test", SystemRoot: process.env.SystemRoot, ...env };
    return spawnSync(process.execPath, [script], { env: childEnv, encoding: "utf8" });
  };

  it("skips a plain preview commit (exit 0) and prints the reason", () => {
    const r = run({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_MESSAGE: "fix: typo" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(SKIP_REASON);
  });

  it("builds production (exit 1)", () => {
    expect(run({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_MESSAGE: "fix: typo" }).status).toBe(1);
  });
});
