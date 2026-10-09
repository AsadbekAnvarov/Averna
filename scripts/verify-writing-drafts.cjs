/** Isolated SQL/service smoke. No env files, DATABASE_URL, hosting or real accounts. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Module = require('node:module');
const { PGlite } = require('@electric-sql/pglite');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
(async () => {
  const pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE students (id TEXT PRIMARY KEY, "userId" TEXT UNIQUE NOT NULL, blacklisted BOOLEAN NOT NULL DEFAULT false); CREATE TABLE ielts_tests (id TEXT PRIMARY KEY, "studentId" TEXT, "completedAt" TIMESTAMP);');
    await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20261009000300_writing_drafts/migration.sql'), 'utf8'));
    await pg.exec(`INSERT INTO students VALUES ('s1','u1',false), ('s2','u2',false);`);
    const adapter = conn => ({
      $queryRaw: async (strings, ...values) => (await conn.query(strings.reduce((s, part, i) => s + part + (i < values.length ? '$' + (i + 1) : ''), ''), values)).rows,
      writingDraft: {
        findUnique: async ({ where }) => { const s = where.studentId_scope; return (await conn.query('SELECT * FROM writing_drafts WHERE "studentId"=$1 AND scope=$2', [s.studentId, s.scope])).rows[0] ?? null; },
        create: async ({ data: d }) => (await conn.query('INSERT INTO writing_drafts (id,"studentId",scope,"promptHash",essay,"attemptId","timeLeft",version,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *', [randomUUID(), d.studentId, d.scope, d.promptHash, d.essay, d.attemptId, d.timeLeft, d.version])).rows[0],
        update: async ({ where, data: d }) => { const s = where.studentId_scope; return (await conn.query('UPDATE writing_drafts SET essay=$1,"attemptId"=$2,"timeLeft"=$3,version=version+1,"updatedAt"=now() WHERE "studentId"=$4 AND scope=$5 RETURNING *', [d.essay, d.attemptId, d.timeLeft, s.studentId, s.scope])).rows[0]; },
      },
    });
    global.__draftDb = { ...adapter(pg), $transaction: fn => pg.transaction(tx => fn(adapter(tx))) };
    const build = await esbuild.build({ entryPoints: [path.join(root, 'lib/writing-drafts/service.ts')], bundle: true, platform: 'node', format: 'cjs', write: false, tsconfig: path.join(root, 'tsconfig.json'), packages: 'external', plugins: [{ name: 'isolated-db', setup(b) { b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'isolated' })); b.onLoad({ filter: /.*/, namespace: 'isolated' }, () => ({ contents: 'export const db = globalThis.__draftDb;', loader: 'js' })); } }] });
    const compiled = new Module(path.join(root, 'scripts/__isolated-drafts.cjs'), module);
    compiled.filename = path.join(root, 'scripts/__isolated-drafts.cjs'); compiled.paths = Module._nodeModulePaths(path.join(root, 'scripts'));
    compiled._compile(build.outputFiles[0].text, compiled.filename);
    const { writeDraft, readDraft } = compiled.exports;
    const input = { taskType: 'task2', promptId: 'one', version: 0, essay: 'Private text', attemptId: 'attempt-123', timeLeft: 100 };
    const first = await writeDraft('u1', input, 'hash'); assert.equal(first.version, 1);
    assert.equal((await writeDraft('u1', input, 'hash')).version, 1); // lost-response replay
    assert.equal(await readDraft('s2', 'task2', 'one', 'hash'), null);
    await writeDraft('u2', { ...input, essay: 'Other account' }, 'hash');
    assert.equal((await readDraft('s1', 'task2', 'one', 'hash')).essay, 'Private text');
    const second = await writeDraft('u1', { ...input, version: 1, essay: 'New version' }, 'hash'); assert.equal(second.version, 2);
    await assert.rejects(writeDraft('u1', { ...input, version: 1, essay: 'Stale device' }, 'hash'), e => e.status === 409);
    assert.equal((await readDraft('s1', 'task2', 'one', 'hash')).essay, 'New version');
    await assert.rejects(readDraft('s1', 'task2', 'one', 'changed'), e => e.status === 409);
    await assert.rejects(writeDraft('u1', { ...input, version: 2, attemptId: 'another-123' }, 'hash', true), e => e.status === 409);
    await writeDraft('u1', { ...input, version: 2 }, 'hash', true);
    assert.equal((await readDraft('s1', 'task2', 'one', 'hash')).essay, '');
    await assert.rejects(writeDraft('u1', { ...input, version: 2 }, 'hash'), e => e.status === 409); // tombstone rejects stale resurrection
    await pg.exec(`UPDATE students SET blacklisted=true WHERE id='s1'`);
    await assert.rejects(writeDraft('u1', { ...input, version: 3 }, 'hash'), e => e.status === 403);
    await pg.exec(`DELETE FROM students WHERE id='s2'`);
    assert.equal((await pg.query(`SELECT * FROM writing_drafts WHERE "studentId"='s2'`)).rows.length, 0);
    console.log('PASS: actual draft service + SQL migration; owner isolation, versions, replay, rollback, task changes, tombstones, blacklist, FK cascade. PGlite is not multi-connection production certification.');
  } finally { delete global.__draftDb; await pg.close(); }
})().catch(e => { console.error(e); process.exit(1); });
