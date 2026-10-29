/** Read-only deployment guard. No paper, answer, audio or student rows are changed. */
if(process.env.LISTENING_PRIVATE_MEDIA!=='on')process.exit(0);
const {PrismaClient}=require('@prisma/client'),registry=require('../lib/ielts/audio/private-media.json');const db=new PrismaClient();
require('esbuild').buildSync({entryPoints:['scripts/cdi-import-logic.ts'],bundle:true,platform:'node',outfile:'/tmp/averna-private-listening-check.cjs'});
const {validateListeningTest,wholeRecordingHash,suppliedPartRecordingHash,gradeTest,toClientListening}=require('/tmp/averna-private-listening-check.cjs');
function assert(ok,message){if(!ok)throw Error(message);}
(async()=>{
 assert(process.env.LISTENING_GITHUB_TOKEN,'Missing private media credential');
 const ids=Object.keys(registry.tests),rows=await db.generatedTest.findMany({where:{id:{in:ids}},select:{id:true,data:true,published:true}}),audio=await db.listeningAudio.findMany({where:{testId:{in:ids}}});assert(rows.length===ids.length,'Missing registered paper');let diagrams=0;
 for(const row of rows){const t={...row.data,id:row.id};assert(t.skill==='LISTENING'&&t.recordingMode==='whole'&&row.published,'Unexpected registered paper');assert(t.recordingSha256===registry.tests[row.id].recordingSha256,'Original recording hash changed: '+row.id);assert(!validateListeningTest(t,{requireFull:true}).errors.length,'Invalid full paper: '+row.id);
  const answers={};for(const p of t.parts)for(const g of p.groups){for(const image of g.images||[]){assert(registry.urls[image.url],'Unmapped Listening diagram: '+row.id);diagrams++;}if(g.kind==='mcq-multi')answers[g.questions[0].n]=g.questions[0].answer;else for(const q of g.questions)answers[q.n]=q.answer[0];}
  const score=gradeTest(t,answers);assert(score.correct===40&&score.total===40,'Self-grading failed: '+row.id);assert(!/"(?:answer|explanation)":/.test(JSON.stringify(toClientListening(t))),'Answer leakage: '+row.id);
  const files=audio.filter(a=>a.testId===row.id);assert(files.length===registry.tests[row.id].audioFiles,'Audio inventory changed: '+row.id);
  for(const file of files){const name=registry.urls[file.url],asset=registry.assets[name];assert(name&&asset&&file.status==='ready'&&file.bytes===asset.bytes&&file.durationMs>0,'Unverified media row: '+row.id);assert(file.scriptHash===(file.partIndex===-1?wholeRecordingHash(t):suppliedPartRecordingHash(t,file.partIndex)),'Stale recording: '+row.id);if(file.partIndex===-1)assert(asset.sha256===t.recordingSha256,'Original bytes mismatch: '+row.id);}
 }
 const sample=Object.values(registry.assets)[0],r=await fetch(`https://api.github.com/repos/${registry.repository}/releases/assets/${sample.id}?t=${Date.now()}`,{headers:{Authorization:`Bearer ${process.env.LISTENING_GITHUB_TOKEN}`,Accept:'application/octet-stream','X-GitHub-Api-Version':'2022-11-28'},redirect:'manual',signal:AbortSignal.timeout(15000)});await r.body?.cancel();assert(r.status===302&&new URL(r.headers.get('location')).hostname==='release-assets.githubusercontent.com','Private GitHub access failed');
 console.log('PRIVATE_LISTENING_VERIFIED '+JSON.stringify({papers:rows.length,questions:rows.length*40,audio:audio.length,diagrams,studentDataChanged:false}));
})().catch(e=>{console.error('Private Listening guard stopped:',e.code||e.name);process.exitCode=1;}).finally(()=>db.$disconnect());
