/** Explicit one-time Volume 10 import. No-op without AVERNA_VOLUME10_IMPORT_SHA256.
 * Source material is private build input, never a public route or browser bundle.
 * Only creates new cdi-vol10-* rows; existing papers and student data are untouched.
 */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const expected=process.env.AVERNA_VOLUME10_IMPORT_SHA256;
if (!expected) process.exit(0);
if(!/^[a-f0-9]{64}$/.test(expected)||process.env.VERCEL_ENV!=='production')throw Error('Explicit production import confirmation required');
const directory=path.resolve('private-import');
const file=path.join(directory,'manifest.json'), bytes=fs.readFileSync(file);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(bytes)!==expected)throw Error('Import manifest checksum mismatch');
const manifest=JSON.parse(bytes);if(manifest.version!==1||manifest.items?.length!==14)throw Error('Expected exactly 14 audited papers');
require('esbuild').buildSync({entryPoints:['scripts/cdi-import-logic.ts'],bundle:true,platform:'node',outfile:'/tmp/cdi-import-logic.cjs'});
const {validateReadingTest,validateListeningTest,wholeRecordingHash,suppliedPartRecordingHash,gradeTest,toClientReading,toClientListening}=require('/tmp/cdi-import-logic.cjs');
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function verifyPaper(t){
 const report=(t.skill==='READING'?validateReadingTest:validateListeningTest)(t,{requireFull:true});if(report.errors.length)throw Error(t.id+': '+report.errors.join('; '));
 const answers={};for(const p of t.parts)for(const g of p.groups){if(g.kind==='mcq-multi')answers[g.questions[0].n]=g.questions[0].answer;else for(const q of g.questions)answers[q.n]=q.answer[0];}
 const score=gradeTest(t,answers);if(score.correct!==40||score.total!==40)throw Error('Self-grading failed: '+t.id);
 const client=t.skill==='READING'?toClientReading(t):toClientListening(t);if(/"(?:answer|explanation)":/.test(JSON.stringify(client)))throw Error('Answer key exposure');
}
(async()=>{
 const ids=new Set();for(const t of manifest.items){if(!/^cdi-vol10-(reading-[1-8]|listening-[1-6])$/.test(t.id)||ids.has(t.id)||t.imported?.provider!=='user-supplied-cdi')throw Error('Unexpected import ID');ids.add(t.id);verifyPaper(t);}
 const existing=await db.generatedTest.findMany({where:{id:{in:[...ids]}},select:{id:true,data:true,published:true}});
 // Read-only inventory first. Reruns may only accept this exact source batch.
 for(const row of existing){const t=manifest.items.find(t=>t.id===row.id);if(row.data?.imported?.sourceSha256!==t.imported.sourceSha256)throw Error('Existing unrelated paper: '+row.id);}
 const otherPapers=await db.generatedTest.findMany({where:{module:{in:['READING','LISTENING']}},select:{id:true,data:true}});
 for(const row of otherPapers)if(!ids.has(row.id)&&manifest.items.some(t=>t.imported.sourceSha256===row.data?.imported?.sourceSha256))throw Error('Source already imported under another ID: '+row.id);
 const inventory=await db.generatedTest.groupBy({by:['module','published'],_count:{_all:true}});console.log('Volume 10 pre-import inventory:',JSON.stringify(inventory));
 const {put,head}=await import('@vercel/blob');const media={};
 for(const asset of manifest.assets){
  if(!/^[a-z0-9-]+\.(mp3|png)$/.test(asset.file))throw Error('Unsafe asset path');
  const body=fs.readFileSync(path.join(directory,asset.file));if(sha(body)!==asset.sha256||body.length!==asset.bytes)throw Error('Asset integrity mismatch');
  const pathname=`cdi/volume10/${asset.sha256.slice(0,20)}/${asset.file}`;
  const url=`https://f7j1xfnfh8uscyie.public.blob.vercel-storage.com/${pathname}`;
  let stored;try{stored=await head(url);}catch(e){if(e?.status!==404&&e?.name!=='BlobNotFoundError')throw e;}
  if(stored){if(stored.size!==asset.bytes)throw Error('Existing asset differs');media[asset.file]=stored.url;}
  else {const result=await put(pathname,body,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:asset.file.endsWith('.mp3')?'audio/mpeg':'image/png',multipart:body.length>5*1024*1024});media[asset.file]=result.url;}
  console.log('Verified media:',asset.file,asset.bytes);
 }
 const records=manifest.items.map(original=>{
  const t=JSON.parse(JSON.stringify(original));for(const p of t.parts)for(const g of p.groups)for(const img of g.images||[]){const name=img.url.split('/').pop();if(!media[name])throw Error('Missing diagram');img.url=media[name];}
  if(JSON.stringify(t).includes('pending.invalid'))throw Error('Unresolved media');verifyPaper(t);
  const audio=[];if(t.skill==='LISTENING'){
   const i=t.imported.testNumber;const specs=[{partIndex:-1,file:`listening-${i}-full.mp3`,durationMs:t.recordingDurationMs,scriptHash:wholeRecordingHash(t),voiceModel:'supplied-whole-v1'},...t.recordingParts.map((c,pi)=>({partIndex:pi,file:`listening-${i}-part-${pi+1}.mp3`,durationMs:manifest.assets.find(a=>a.file===`listening-${i}-part-${pi+1}.mp3`).durationMs,scriptHash:suppliedPartRecordingHash(t,pi),voiceModel:'supplied-part-v1'}))];
   for(const spec of specs){if(!media[spec.file]||!spec.scriptHash)throw Error('Missing verified recording');audio.push({testId:t.id,partIndex:spec.partIndex,status:'ready',url:media[spec.file],bytes:manifest.assets.find(a=>a.file===spec.file).bytes,durationMs:spec.durationMs,scriptHash:spec.scriptHash,voiceModel:spec.voiceModel,timeline:[]});}
  }
  return {test:t,audio};
 });
 // One transaction: no half-imported catalog, no modification to any older ID.
 await db.$transaction(async tx=>{
  for(const r of records){const row=await tx.generatedTest.findUnique({where:{id:r.test.id}});if(row){if(!equal(row.data,r.test))throw Error('Refusing to overwrite existing paper '+row.id);const audio=await tx.listeningAudio.findMany({where:{testId:row.id}});for(const a of r.audio){const found=audio.find(v=>v.partIndex===a.partIndex);if(!found||found.scriptHash!==a.scriptHash||found.url!==a.url)throw Error('Existing recording differs');}continue;}
   await tx.generatedTest.create({data:{id:r.test.id,module:r.test.skill,title:r.test.title,description:r.test.description,published:false,data:r.test}});
   for(const a of r.audio)await tx.listeningAudio.create({data:a});
  }
  const check=await tx.generatedTest.findMany({where:{id:{in:[...ids]}}});if(check.length!==14)throw Error('Readback count differs');for(const row of check){const r=records.find(r=>r.test.id===row.id);if(!equal(row.data,r.test))throw Error('Readback differs');}
  await tx.generatedTest.updateMany({where:{id:{in:[...ids]}},data:{published:true}});
 },{maxWait:20000,timeout:60000});
 const published=await db.generatedTest.count({where:{id:{in:[...ids]},published:true}}),audio=await db.listeningAudio.count({where:{testId:{in:[...ids]},status:'ready'}});if(published!==14||audio!==30)throw Error('Publication verification failed');
 console.log('VOLUME10_IMPORT_VERIFIED '+JSON.stringify({published,reading:8,listening:6,questions:560,audio,diagrams:4,ids:[...ids]}));
})().catch(e=>{console.error('Volume 10 import stopped:',e.code||e.name||'error',String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]').slice(0,600));process.exitCode=1;}).finally(()=>db.$disconnect());
