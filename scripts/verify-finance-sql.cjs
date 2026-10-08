/* Isolated SQL smoke checks, never a hosted connection. Install @electric-sql/pglite
   in a separate test directory and expose it via NODE_PATH to run this script. */
const { PGlite }=require('@electric-sql/pglite');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');const pg=new PGlite();
 for(const m of ['20261008000100_baseline','20261008000200_production_learning','20261008000300_writing_retry','20261008000400_admin_finance'])await pg.exec(fs.readFileSync(path.join(root,'prisma/migrations',m,'migration.sql'),'utf8'));
 const deploy=fs.readFileSync(path.join(root,'prisma/sql/deploy.sql'),'utf8');await pg.exec(deploy);await pg.exec(deploy);
 await pg.exec(`INSERT INTO users(id,email,password,"updatedAt") VALUES ('u','qa@example.test','test',now()); INSERT INTO students(id,"userId",balance,"updatedAt") VALUES ('s','u',999,now());
 INSERT INTO finance_periods(id,month,opening) VALUES ('p','2026-10','{"CASH":"1000000"}');
 INSERT INTO finance_staff(id,"fullName","shareBps") VALUES ('staff','Synthetic QA Staff',6600);
 INSERT INTO finance_learners(id,"fullName","groupName","staffId","monthlyFee","dueDay") VALUES ('learner','Synthetic QA Learner','QA Group','staff',500000,5);
 INSERT INTO finance_invoices(id,"periodId","learnerId","staffId","learnerName","groupName","staffName","shareBps",amount,"dueAt") VALUES ('invoice','p','learner','staff','Synthetic QA Learner','QA Group','Synthetic QA Staff',6600,500000,'2026-10-05');
 INSERT INTO finance_entries(id,"periodId",kind,amount,earned,channel,"invoiceId","staffId",description,"occurredAt","actorId","actorName") VALUES ('receipt','p','TUITION',500000,330000,'CASH','invoice','staff','QA receipt','2026-10-02','u','QA Admin');`);
 assert.equal((await pg.query(`SELECT balance FROM students WHERE id='s'`)).rows[0].balance,999);
 try{await pg.transaction(async tx=>{await tx.query(`SELECT id FROM finance_periods WHERE month='2026-10' FOR UPDATE`);await tx.exec(`INSERT INTO finance_entries(id,"periodId",kind,amount,channel,description,"occurredAt","actorId","actorName") VALUES ('rollback','p','EXPENSE',-100,'CASH','QA rollback',now(),'u','QA')`);throw new Error('audit failure')})}catch{}
 assert.equal((await pg.query(`SELECT id FROM finance_entries WHERE id='rollback'`)).rows.length,0);
 for(const bad of [`UPDATE finance_staff SET "shareBps"=10001 WHERE id='staff'`,`UPDATE finance_learners SET "dueDay"=31 WHERE id='learner'`,`UPDATE finance_invoices SET amount=-1 WHERE id='invoice'`,`UPDATE finance_entries SET amount=-500000 WHERE id='receipt'`]){let rejected=false;try{await pg.exec(bad)}catch{rejected=true}assert.ok(rejected)}
 await pg.exec(`INSERT INTO finance_entries(id,"periodId",kind,amount,earned,channel,"invoiceId","staffId","reversesId",description,"occurredAt","actorId","actorName") VALUES ('reverse','p','REVERSAL',-500000,-330000,'CASH','invoice','staff','receipt','QA reverse',now(),'u','QA')`);
 const total=(await pg.query(`SELECT SUM(amount)::text AS cash,SUM(earned)::text AS earned FROM finance_entries`)).rows[0];assert.equal(total.cash,'0');assert.equal(total.earned,'0');
 let restricted=false;try{await pg.exec(`DELETE FROM finance_learners WHERE id='learner'`)}catch{restricted=true}assert.ok(restricted);
 await pg.exec(`DELETE FROM students WHERE id='s'`);assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM finance_invoices`)).rows[0].n,1);
 console.log('PASS isolated PGlite: all migrations; compatibility SQL applied twice; exact reversal; atomic rollback; CHECK/FK safeguards; platform balances untouched; financial history retained. Real multi-connection Prisma locking still requires staging tests.');await pg.close();process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
