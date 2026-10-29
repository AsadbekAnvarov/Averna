/** One-time, explicit, verified CDI import. Archive JS is never executed.
 * Dry run by default. Pass a locally audited manifest and --apply only for
 * the isolated staging endpoint printed by Neon. No live publish/enable step.
 *
 * With --apply (Volume 10 additions, scripts/cdi-apply-plan.cjs):
 *   1. listening_part_segments must exist with every column (prisma/sql/deploy.sql);
 *   2. every manifest id is checked first — any conflict stops before the first write;
 *   3. one transaction per paper: GeneratedTest (unpublished), its whole-recording
 *      ListeningAudio row (partIndex -1) and its listening_part_segments row.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { Prisma, PrismaClient } = require("@prisma/client");
const { missingColumns, planApply, nextSegmentsRow, audioRow } = require("./cdi-apply-plan.cjs");
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
let actualHost = null;
try { actualHost = new URL(process.env.DATABASE_URL || "").hostname; } catch { actualHost = null; }
if (!process.env.DATABASE_URL || !expected || actualHost !== expected) throw Error("Explicit staging host confirmation is required");
const db = new PrismaClient();
(async () => {
  // 1. Schema of the boundaries table.
  const cols = await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'listening_part_segments'");
  const missing = missingColumns(cols.map(c => c.column_name));
  if (missing.length) {
    console.error(`listening_part_segments is missing columns: ${missing.join(", ")}. Apply prisma/sql/deploy.sql first; nothing was written.`);
    process.exitCode = 1;
    return;
  }
  // 2. Conflicts, all ids at once.
  const existing = await db.generatedTest.findMany({ where: { id: { in: manifest.items.map(i => i.id) } }, select: { id: true, data: true, published: true, module: true } });
  const plan = planApply(manifest.items, existing);
  if (!plan.ok) {
    for (const c of plan.conflicts) console.error(`Conflict: ${c.id} — ${c.reason}`);
    console.error("Nothing was written.");
    process.exitCode = 1;
    return;
  }
  // 3. One transaction per paper.
  const applied = [];
  for (const item of manifest.items) {
    try {
      await db.$transaction(async tx => {
        const row = await tx.generatedTest.findUnique({ where: { id: item.id }, select: { data: true, published: true } });
        // Never overwrite a live paper or a non-import record.
        if (row && (row.published || row.data?.imported?.provider !== "user-supplied-cdi")) throw Error("Existing live/non-import paper cannot be overwritten");
        const data = { module: item.module, title: item.title, description: "Verified supplied CDI archive import", published: false, data: item.data };
        await tx.generatedTest.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
        if (item.audio) {
          const audio = audioRow(item);
          await tx.listeningAudio.upsert({ where: { testId_partIndex: { testId: item.id, partIndex: -1 } }, create: { testId: item.id, partIndex: -1, ...audio }, update: audio });
          const prev = await tx.listeningPartSegments.findUnique({ where: { testId: item.id } });
          const next = nextSegmentsRow(prev, item);
          if (next.warning) console.warn(next.warning);
          const { warning: _w, ...rest } = next;
          // A nullable JSON column is cleared with Prisma.DbNull (plain null is refused).
          const seg = { ...rest, segments: rest.segments == null ? Prisma.DbNull : rest.segments };
          await tx.listeningPartSegments.upsert({ where: { testId: item.id }, create: { testId: item.id, ...seg }, update: seg });
        }
      });
      applied.push(item.id);
    } catch {
      const rest = manifest.items.map(i => i.id).filter(id => !applied.includes(id));
      console.error(`Import stopped at ${item.id}; database error details suppressed.`);
      console.error(`Applied: ${applied.join(", ") || "none"}`);
      console.error(`Not applied: ${rest.join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`Imported ${applied.length} papers as UNPUBLISHED staging records. Publication and rollout remain separate explicit steps.`);
})().catch(() => { console.error("Import failed; database credential details suppressed."); process.exitCode = 1; }).finally(() => db.$disconnect());
