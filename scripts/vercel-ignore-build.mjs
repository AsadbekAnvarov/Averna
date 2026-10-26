/**
 * Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
 *
 *   node scripts/vercel-ignore-build.mjs
 *
 * Vercel runs this before every build: exit 1 = build, exit 0 = skip.
 * Every retained deployment keeps its own function bundles (Hobby "Functions
 * Storage", 10 GB), so previews are built only on request:
 *
 *   - production deployments always build;
 *   - no commit message (deploy hook, CLI, manual redeploy) → build;
 *   - "[preview]" anywhere in the commit message (any case) → build;
 *   - project env AVERNA_FORCE_PREVIEW=1 → build;
 *   - otherwise the preview is skipped.
 *
 * Any unexpected error builds (fail open). No dependencies: Vercel runs this
 * before `npm install`.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKIP_REASON = "Preview skipped: add [preview] to the commit message to build one";

const PREVIEW_TAG = /\[preview\]/i;

/**
 * Pure: decides whether Vercel should build, and why.
 * @param {Record<string, string | undefined> | null | undefined} env
 * @returns {{ build: boolean, reason: string }}
 */
export function buildDecision(env) {
  try {
    if (env.VERCEL_ENV === "production") return { build: true, reason: "Production deployment: building" };
    const message = env.VERCEL_GIT_COMMIT_MESSAGE;
    if (typeof message !== "string" || message.trim() === "") {
      return { build: true, reason: "No commit message (deploy hook, CLI or redeploy): building" };
    }
    if (PREVIEW_TAG.test(message)) return { build: true, reason: "Commit message has [preview]: building" };
    if (env.AVERNA_FORCE_PREVIEW === "1") return { build: true, reason: "AVERNA_FORCE_PREVIEW=1: building" };
    return { build: false, reason: SKIP_REASON };
  } catch (e) {
    return { build: true, reason: `Ignore check failed (${e instanceof Error ? e.message : String(e)}): building` };
  }
}

/**
 * Pure: true = build (Vercel exit 1), false = skip (exit 0).
 * @param {Record<string, string | undefined> | null | undefined} env
 * @returns {boolean}
 */
export function shouldBuild(env) {
  return buildDecision(env).build;
}

// Only exit when run from the CLI, so the functions can be imported in tests.
const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
const invokedPath = process.argv[1] ? norm(resolve(process.argv[1])) : "";
if (invokedPath === norm(fileURLToPath(import.meta.url))) {
  const { build, reason } = buildDecision(process.env);
  console.log(reason);
  process.exit(build ? 1 : 0);
}
