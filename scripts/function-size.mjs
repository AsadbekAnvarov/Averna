/**
 * Reports how big the serverless functions of a `next build` are, and how many
 * distinct Node function configs the app declares.
 *
 *   npm run build && npm run size:functions
 *   node scripts/function-size.mjs --max-mb 60 --max-configs 1   # CI gate
 *
 * Size: every `.next/server/**\/*.nft.json` (one per traced route) lists the
 * files that route needs at runtime. The union of those files is roughly what
 * one Vercel function bundle carries; the top contributors are grouped by
 * node_modules package (or top-level folder).
 *
 * Configs: Vercel groups Next.js routes into one bundle per function config,
 * and each bundle carries its own copy of the Prisma engine and Next runtime.
 * So `export const maxDuration` / `preferredRegion` / `memory` in app/** are
 * counted: default + each distinct value combination. Edge routes are not Node
 * functions and are left out.
 *
 * Options: --max-mb <n> fails when the union exceeds n MB; --max-configs <n>
 * fails when there are more than n distinct Node configs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MB = 1024 * 1024;
const TOP = 8;

const CONFIG_RE = /^\s*export\s+const\s+(maxDuration|preferredRegion|memory)\b\s*(?::[^=]+)?=\s*([^;\n]+)/gm;
const EDGE_RE = /^\s*export\s+const\s+runtime\s*=\s*["']edge["']/m;
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`;
const toPosix = (p) => p.split("\\").join("/");

function walk(dir, keep, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, keep, out);
    else if (keep(entry.name)) out.push(p);
  }
  return out;
}

/** "node_modules/@prisma/client/x.js" → "@prisma/client"; "lib/db.ts" → "lib". */
export function groupOf(relPath) {
  const parts = toPosix(relPath).split("/");
  const i = parts.lastIndexOf("node_modules");
  if (i !== -1 && i + 1 < parts.length - 1) {
    const name = parts[i + 1];
    return name.startsWith("@") && i + 2 < parts.length - 1 ? `${name}/${parts[i + 2]}` : name;
  }
  if (parts[0] === "..") return "(outside project)";
  return parts.length > 1 ? parts[0] : "(project root files)";
}

/** Distinct Node function configs declared in app/** (default + each distinct combination). */
export function scanRouteConfigs(appDir = join(root, "app")) {
  const configured = [];
  let edge = 0;
  for (const file of walk(appDir, (n) => SOURCE_RE.test(n))) {
    const src = readFileSync(file, "utf8");
    if (EDGE_RE.test(src)) {
      edge++;
      continue;
    }
    const found = {};
    for (const m of src.matchAll(CONFIG_RE)) found[m[1]] = m[2].trim().replace(/\s+/g, " ");
    const keys = Object.keys(found).sort();
    if (keys.length) {
      configured.push({ file: toPosix(relative(root, file)), signature: keys.map((k) => `${k}=${found[k]}`).join(", ") });
    }
  }
  const signatures = [...new Set(configured.map((c) => c.signature))].sort();
  return { configured, signatures, distinct: 1 + signatures.length, edge };
}

/** Sizes of the files traced by `.next/server/**\/*.nft.json`. */
export function measureTraces(serverDir = join(root, ".next", "server")) {
  const sizes = new Map(); // absolute path → bytes (null when missing)
  const sizeOf = (p) => {
    if (!sizes.has(p)) {
      try {
        const s = statSync(p);
        sizes.set(p, s.isFile() ? s.size : null);
      } catch {
        sizes.set(p, null);
      }
    }
    return sizes.get(p);
  };

  const traces = walk(serverDir, (n) => n.endsWith(".nft.json"));
  let biggest = { route: "", bytes: 0, files: 0 };
  for (const trace of traces) {
    const base = dirname(trace);
    const { files = [] } = JSON.parse(readFileSync(trace, "utf8"));
    const entry = trace.slice(0, -".nft.json".length);
    const own = new Set([entry, ...files.map((f) => resolve(base, f))]);
    let bytes = 0;
    for (const p of own) bytes += sizeOf(p) ?? 0;
    if (bytes > biggest.bytes) biggest = { route: toPosix(relative(serverDir, entry)), bytes, files: own.size };
  }

  let union = 0;
  let count = 0;
  const groups = new Map();
  for (const [p, bytes] of sizes) {
    if (bytes == null) continue;
    union += bytes;
    count++;
    const key = groupOf(relative(root, p));
    groups.set(key, (groups.get(key) ?? 0) + bytes);
  }
  const top = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  return { routes: traces.length, union, count, biggest, top };
}

function numberArg(args, name) {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return undefined;
  const raw = args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  const n = Number(raw);
  if (raw === undefined || !Number.isFinite(n) || n < 0) throw new Error(`${name} needs a non-negative number`);
  return n;
}

function main() {
  const args = process.argv.slice(2);
  const maxMb = numberArg(args, "--max-mb");
  const maxConfigs = numberArg(args, "--max-configs");
  const serverDir = join(root, ".next", "server");
  if (!existsSync(serverDir)) {
    console.error("function-size: .next/server not found — run `npm run build` first.");
    process.exit(1);
  }

  const size = measureTraces(serverDir);
  if (size.routes === 0) {
    console.error("function-size: no .nft.json traces under .next/server — was this a `next build`?");
    process.exit(1);
  }
  const configs = scanRouteConfigs();

  console.log("Function size (.next/server/**/*.nft.json)");
  console.log(`  Traced route files:    ${size.routes}`);
  console.log(`  Union of traced files: ${mb(size.union)} (${size.count} files)`);
  console.log(`  Biggest single route:  ${mb(size.biggest.bytes)} (${size.biggest.files} files) ${size.biggest.route}`);
  console.log(`  Top ${TOP} contributors:`);
  for (const [key, bytes] of size.top) console.log(`    ${mb(bytes).padStart(9)}  ${key}`);
  console.log(
    `Node function configs (app/** maxDuration / preferredRegion / memory): ${configs.distinct}` +
      (configs.signatures.length ? "" : " (default only)") +
      (configs.edge ? `; ${configs.edge} edge route(s) not counted` : ""),
  );
  for (const sig of configs.signatures) {
    const n = configs.configured.filter((c) => c.signature === sig).length;
    console.log(`  ${sig}: ${n} file(s)`);
  }

  let failed = false;
  if (maxMb !== undefined && size.union > maxMb * MB) {
    console.error(`function-size: union ${mb(size.union)} exceeds --max-mb ${maxMb}. See docs/vercel-resources.md.`);
    failed = true;
  }
  if (maxConfigs !== undefined && configs.distinct > maxConfigs) {
    console.error(
      `function-size: ${configs.distinct} distinct Node function configs exceed --max-configs ${maxConfigs}. ` +
        "Each config is a separate Vercel bundle with its own Prisma engine; remove the per-route exports:",
    );
    for (const c of configs.configured) console.error(`  ${c.file}: ${c.signature}`);
    failed = true;
  }
  if (failed) process.exit(1);
}

// Only run when called from the CLI, so the helpers can be imported.
const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
const invokedPath = process.argv[1] ? norm(resolve(process.argv[1])) : "";
if (invokedPath === norm(fileURLToPath(import.meta.url))) main();
