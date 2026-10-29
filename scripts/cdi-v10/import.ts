/**
 * Volume 10 Content_Importer CLI (offline; never part of the app bundle).
 *
 *   npm run cdi:v10 -- dry-run --reading <dir> --listening <dir> --out <dir> --media-base <https URL> [--no-silence]
 *   npm run cdi:v10 -- stage --out <dir> --pages-repo <clone of averna-cdi-audio> [--apply --expected-upload-host <owner>.github.io]
 *   npm run cdi:v10 -- verify --out <dir>
 *
 * dry-run touches no database and no network. --out must be outside the repository:
 * the manifest holds answer keys and transcripts and the repository is public.
 */

import { execFileSync } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { budgetDecision, confirmHost, hostOf, HOST_BUDGET_BYTES } from "../../lib/cdi-import/budget";
import { buildManifest, manifestText, resolveManifestAssets, type Manifest } from "../../lib/cdi-import/manifest";
import { convertSource, type SourceResult } from "../../lib/cdi-import/pipeline";
import { buildReport, reportMarkdown } from "../../lib/cdi-import/report";
import { pausesFromMp3 } from "../../lib/cdi-import/silence";
import { outsideRepo } from "../../lib/cdi-import/paths";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

type Args = { cmd: string; flags: Map<string, string | true> };

function parseArgs(argv: string[]): Args {
  const [cmd = "", ...rest] = argv;
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) flags.set(a.slice(2, eq), a.slice(eq + 1));
    else if (rest[i + 1] && !rest[i + 1].startsWith("--")) flags.set(a.slice(2), rest[++i]);
    else flags.set(a.slice(2), true);
  }
  return { cmd, flags };
}

function need(args: Args, name: string): string {
  const v = args.flags.get(name);
  if (typeof v !== "string" || !v) throw new Error(`Missing --${name}.`);
  return v;
}



function sha256(b: Uint8Array): string {
  return createHash("sha256").update(b).digest("hex");
}

interface Config {
  mediaBase: string;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

async function dryRun(args: Args) {
  const out = path.resolve(need(args, "out"));
  if (!outsideRepo(out, REPO_ROOT)) throw new Error("--out must be outside the repository (the manifest contains answer keys).");
  const mediaBase = need(args, "media-base");
  if (!mediaBase.startsWith("https://")) throw new Error("--media-base must be an https:// URL.");
  const dirs = [args.flags.get("reading"), args.flags.get("listening")].filter((d): d is string => typeof d === "string");
  if (!dirs.length) throw new Error("Pass --reading and/or --listening.");
  const silence = !args.flags.has("no-silence");
  const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => /\.html?$/i.test(f)).map((f) => ({ dir: d, file: f })));
  files.sort((a, b) => a.file.localeCompare(b.file));
  const results: SourceResult[] = [];
  for (const f of files) {
    process.stdout.write(`… ${f.file}\n`);
    const bytes = new Uint8Array(fs.readFileSync(path.join(f.dir, f.file)));
    results.push(await convertSource({ file: f.file, bytes, mediaBase, detectPauses: silence ? pausesFromMp3 : undefined }));
  }
  fs.mkdirSync(path.join(out, "media"), { recursive: true });
  for (const r of results) {
    for (const m of r.media) {
      const target = path.join(out, "media", ...m.path.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target) || sha256(new Uint8Array(fs.readFileSync(target))) !== m.sha256) fs.writeFileSync(target, m.bytes);
    }
  }
  const manifest = buildManifest(results);
  const report = buildReport(results);
  fs.writeFileSync(path.join(out, "manifest.json"), manifestText(manifest));
  fs.writeFileSync(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(out, "report.md"), reportMarkdown(report));
  const instructions = results
    .filter((r) => r.paper && r.meta)
    .map((r) => ({ id: r.meta!.id, skill: r.meta!.skill, lines: r.instructions }))
    .sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(out, "instructions.json"), `${JSON.stringify(instructions, null, 2)}\n`);
  fs.writeFileSync(path.join(out, "import-config.json"), `${JSON.stringify({ mediaBase } satisfies Config, null, 2)}\n`);
  console.log(`Dry run: ${report.totals.inManifest} of ${report.totals.files} papers in the manifest, ${report.totals.excluded} excluded. Nothing was uploaded or written to a database.`);
  console.log(`Report: ${path.join(out, "report.md")}`);
}

function git(cwd: string, ...a: string[]): string {
  return execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function walkFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(p, base) : [path.relative(base, p).split(path.sep).join("/")];
  });
}

async function stage(args: Args) {
  const out = path.resolve(need(args, "out"));
  const clone = path.resolve(need(args, "pages-repo"));
  const { mediaBase } = readJson<Config>(path.join(out, "import-config.json"));
  const apply = args.flags.has("apply");
  const expected = args.flags.get("expected-upload-host");
  const host = hostOf(mediaBase);
  const owner = host?.endsWith(".github.io") ? host.slice(0, -".github.io".length) : null;
  if (apply) {
    const ok = confirmHost(typeof expected === "string" ? expected : null, mediaBase);
    if (!ok.ok) throw new Error(ok.message);
  }
  let remote = "";
  try {
    remote = git(clone, "remote", "get-url", "origin");
  } catch {
    throw new Error("--pages-repo is not a git clone with an origin remote.");
  }
  if (!owner || !new RegExp(`github\\.com[:/]${owner}/averna-cdi-audio(\\.git)?$`, "i").test(remote)) {
    throw new Error("The clone's origin is not github.com/<owner>/averna-cdi-audio for the media host; nothing was copied.");
  }
  const branch = git(clone, "rev-parse", "--abbrev-ref", "HEAD");
  let used: number | null = null;
  try {
    git(clone, "fetch", "origin", branch);
    used = git(clone, "ls-tree", "-r", "-l", `origin/${branch}`)
      .split("\n")
      .filter(Boolean)
      .reduce((n, l) => n + (Number(l.split(/\s+/)[3]) || 0), 0);
  } catch {
    used = null;
  }
  const mediaDir = path.join(out, "media");
  const files = walkFiles(mediaDir);
  const fresh = files.filter((rel) => {
    const target = path.join(clone, ...rel.split("/"));
    return !fs.existsSync(target) || sha256(new Uint8Array(fs.readFileSync(target))) !== sha256(new Uint8Array(fs.readFileSync(path.join(mediaDir, ...rel.split("/")))));
  });
  const newBytes = fresh.reduce((n, rel) => n + fs.statSync(path.join(mediaDir, ...rel.split("/"))).size, 0);
  const decision = budgetDecision(used, newBytes);
  console.log(JSON.stringify({ dryRun: !apply, newFiles: fresh.length, newBytes, usedBytes: used, limitBytes: HOST_BUDGET_BYTES, withinBudget: decision.ok }));
  if (!decision.ok) throw new Error(`Upload refused: used ${used ?? "unknown"} + new ${newBytes} bytes is over the ${HOST_BUDGET_BYTES}-byte budget (or the used size is unknown).`);
  if (!apply) return console.log("Dry run: pass --apply --expected-upload-host <owner>.github.io to copy, commit and push.");
  for (const rel of fresh) {
    const target = path.join(clone, ...rel.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(mediaDir, ...rel.split("/")), target);
  }
  if (!fresh.length) return console.log("Every file is already on the host.");
  git(clone, "add", "--", ...fresh);
  git(clone, "commit", "-m", "Volume 10 media");
  git(clone, "push", "origin", branch);
  console.log(`Pushed ${fresh.length} files. GitHub Pages deploys them in a few minutes; then run verify.`);
}

async function checkFile(url: string, sha: string): Promise<string | null> {
  const full = await fetch(url);
  if (!full.ok) return `GET ${full.status}`;
  const body = new Uint8Array(await full.arrayBuffer());
  if (sha256(body) !== sha) return "SHA-256 differs";
  const acao = full.headers.get("access-control-allow-origin");
  if (acao !== "*" && !(acao && /averna/i.test(acao))) return "no Access-Control-Allow-Origin";
  const part = await fetch(url, { headers: { Range: "bytes=0-99" } });
  if (part.status !== 206) return `Range answered ${part.status}`;
  if ((await part.arrayBuffer()).byteLength !== 100) return "Range length differs";
  return null;
}

async function verify(args: Args) {
  const out = path.resolve(need(args, "out"));
  const { mediaBase } = readJson<Config>(path.join(out, "import-config.json"));
  const pendingFile = path.join(out, "manifest.pending.json");
  if (!fs.existsSync(pendingFile)) fs.copyFileSync(path.join(out, "manifest.json"), pendingFile);
  const manifest = readJson<Manifest>(pendingFile);
  const base = mediaBase.endsWith("/") ? mediaBase : `${mediaBase}/`;
  const deadline = Date.now() + 15 * 60_000;
  const failed = new Map<string, string>();
  for (const it of manifest.items) {
    for (const m of it.media) {
      let why: string | null = "not checked";
      for (;;) {
        try {
          why = await checkFile(base + m.path, m.sha256);
        } catch (e) {
          why = e instanceof Error ? e.message : String(e);
        }
        if (!why || Date.now() > deadline) break;
        console.log(`${m.path}: ${why} — trying again in 30 s`);
        await new Promise((r) => setTimeout(r, 30_000));
      }
      if (why) failed.set(it.id, `${m.path}: ${why}`);
    }
  }
  const kept: Manifest = { ...manifest, items: manifest.items.filter((it) => !failed.has(it.id)) };
  fs.writeFileSync(path.join(out, "manifest.json"), manifestText(resolveManifestAssets(kept, base)));
  for (const [id, why] of Array.from(failed.entries())) console.log(`Excluded ${id}: ${why}`);
  console.log(`Verified ${kept.items.length} of ${manifest.items.length} papers; manifest.json now carries HTTPS media URLs.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.cmd === "dry-run") return dryRun(args);
  if (args.cmd === "stage") return stage(args);
  if (args.cmd === "verify") return verify(args);
  throw new Error("Usage: npm run cdi:v10 -- dry-run | stage | verify (see scripts/cdi-v10/import.ts).");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
