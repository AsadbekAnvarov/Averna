/** One-time, explicit, verified CDI import. Archive JS is never executed.
 * Dry run by default. Pass a locally audited manifest and --apply only for
 * the isolated staging endpoint printed by Neon. No live publish/enable step.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
if (!file) throw Error("Usage: node scripts/import-cdi-manifest.cjs manifest.json [--apply --expected-host=HOST]");
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.items) || !manifest.items.length) throw Error("Audited manifest is required");
const allowed = new Set(["READING", "LISTENING", "WRITING", "WRITING_TASK1", "CDI_SAMPLE"]);
const ids = new Set();
for (const item of manifest.items) {
  if (!/^cdi-[a-z0-9-]+$/.test(item.id) || ids.has(item.id) || !allowed.has(item.module)) throw Error("Invalid/duplicate import record");
  ids.add(item.id);
  if (item.validated !== true || item.contentSha256 !== crypto.createHash("sha256").update(JSON.stringify(item.data)).digest("hex")) throw Error("Unvalidated/changed content");
  if (JSON.stringify(item.data).includes("cdi-asset://")) throw Error("Media upload is incomplete");
  if (item.module === "LISTENING" && (!item.audio || !item.audio.url.startsWith("https://") || item.audio.partIndex !== -1 || item.data.recordingMode !== "whole")) throw Error("Verified whole recording is required");
}
console.log(JSON.stringify({ dryRun: !args.includes("--apply"), records: manifest.items.length, modules: [...allowed].map(module => ({ module, records: manifest.items.filter(i => i.module === module).length })) }));
if (!args.includes("--apply")) process.exit(0);
const expected = args.find(a => a.startsWith("--expected-host="))?.slice(16);
if (!process.env.DATABASE_URL || !expected || new URL(process.env.DATABASE_URL).hostname !== expected) throw Error("Explicit staging host confirmation is required");
const db = new PrismaClient();
(async () => {
  for (const item of manifest.items) {
    await db.$transaction(async tx => {
      const existing = await tx.generatedTest.findUnique({ where: { id: item.id }, select: { data: true, published: true } });
      // Never overwrite a live paper or a non-import record.
      if (existing && (existing.published || existing.data?.imported?.provider !== "user-supplied-cdi")) throw Error("Existing live/non-import paper cannot be overwritten");
      const data = { module: item.module, title: item.title, description: "Verified supplied CDI archive import", published: false, data: item.data };
      await tx.generatedTest.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      if (item.audio) {
        const a = item.audio;
        const audio = { status: "ready", url: a.url, bytes: a.bytes, durationMs: a.durationMs, scriptHash: a.scriptHash, voiceModel: "supplied-whole-v1", timeline: [] };
        await tx.listeningAudio.upsert({ where: { testId_partIndex: { testId: item.id, partIndex: -1 } }, create: { testId: item.id, partIndex: -1, ...audio }, update: audio });
      }
    });
  }
  console.log("Imported as UNPUBLISHED staging records. Publication and rollout remain separate explicit steps.");
})().catch(() => { console.error("Import failed; database credential details suppressed."); process.exitCode = 1; }).finally(() => db.$disconnect());
