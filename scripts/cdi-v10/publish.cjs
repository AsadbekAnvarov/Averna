/**
 * Publish (or, with --unpublish, withdraw) imported CDI papers.
 *   node scripts/cdi-v10/publish.cjs --ids=<id,…> [--unpublish] [--apply --expected-host=<db host>]
 * Dry run by default. Only listed CDI imports of Reading / Listening change;
 * a Listening paper is published only with its ready HTTPS whole recording.
 * Nothing is deleted: papers, recordings, boundaries and results stay.
 */
const { PrismaClient } = require("@prisma/client");
const { planPublish } = require("../cdi-apply-plan.cjs");

const args = process.argv.slice(2);
const idsArg = args.find((a) => a.startsWith("--ids="));
const ids = idsArg ? idsArg.slice(6).split(",").map((s) => s.trim()).filter(Boolean) : [];
if (!ids.length || ids.some((id) => !/^cdi-[a-z0-9-]+$/.test(id))) throw Error("Usage: node scripts/cdi-v10/publish.cjs --ids=cdi-v10-reading-01,… [--unpublish] [--apply --expected-host=HOST]");
const publish = !args.includes("--unpublish");
const apply = args.includes("--apply");
const expected = args.find((a) => a.startsWith("--expected-host="))?.slice(16);
let host = null;
try { host = new URL(process.env.DATABASE_URL || "").hostname; } catch { host = null; }
if (apply && (!process.env.DATABASE_URL || !expected || host !== expected)) throw Error("Explicit database host confirmation is required (--expected-host).");
if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ dryRun: true, action: publish ? "publish" : "unpublish", ids, note: "No DATABASE_URL: nothing was checked." }));
  process.exit(0);
}
const db = new PrismaClient();
(async () => {
  const rows = await db.generatedTest.findMany({ where: { id: { in: ids } }, select: { id: true, module: true, data: true, published: true } });
  const audio = await db.listeningAudio.findMany({ where: { testId: { in: ids }, partIndex: -1 }, select: { testId: true, partIndex: true, status: true, url: true, durationMs: true } });
  const plan = planPublish(ids, rows, audio, publish);
  console.log(JSON.stringify({ dryRun: !apply, action: publish ? "publish" : "unpublish", change: plan.ok, refused: plan.refused }));
  if (!apply || !plan.ok.length) return;
  const r = await db.generatedTest.updateMany({ where: { id: { in: plan.ok } }, data: { published: publish } });
  console.log(`${publish ? "Published" : "Unpublished"} ${r.count} papers. The libraries update within 300 s.`);
})().catch(() => { console.error("Publishing failed; database credential details suppressed."); process.exitCode = 1; }).finally(() => db.$disconnect());
