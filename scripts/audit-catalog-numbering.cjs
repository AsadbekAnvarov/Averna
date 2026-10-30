/** Read-only deployment check of real published catalogs. Never changes rows. */
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const dir=path.resolve('.next/catalog-numbering-audit');fs.mkdirSync(dir,{recursive:true});
 const stub=path.join(dir,'cache-stub.cjs');fs.writeFileSync(stub,'exports.cache=fn=>fn;exports.unstable_cache=fn=>fn;');
 const file=path.join(dir,'audit.cjs');await require('esbuild').build({stdin:{contents:"export {listReadingExams,listListeningExams,listWritingTasks} from './lib/ielts/catalog'; export {db} from './lib/db';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:file,alias:{react:stub,'next/cache':stub}});
 const catalog=require(file);const lists=[['READING',await catalog.listReadingExams()],['LISTENING',await catalog.listListeningExams()],['WRITING_TASK1',await catalog.listWritingTasks('task1')],['WRITING_TASK2',await catalog.listWritingTasks('task2')]];const report=[];
 for(const [skill,rows]of lists){if(!rows.length)throw Error('Empty catalog: '+skill);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate paper IDs: '+skill);const groups=new Map();
  for(const row of rows){const m=/^(Averna\s+CDI\b.*?\b(Reading|Listening|Writing)(?:\s+Test)?\s+)(\d+)(.*)$/i.exec(row.title);if(!m)continue;const volume=/\bVolume\s*(\d+)\b/i.exec(m[1])?.[1]||'original';const key=[volume,row.source||'writing',row.full===undefined?'task':row.full?'full':'practice'].join(':');groups.set(key,[...(groups.get(key)||[]),Number(m[3])]);}
  if(!groups.size)throw Error('No numbered CDI series: '+skill);
  for(const [key,numbers]of groups)if(!numbers.every((n,i)=>n===i+1))throw Error('Display numbering gap: '+skill+':'+key);
  report.push({skill,papers:rows.length,series:[...groups].map(([collection,numbers])=>({collection,first:numbers[0],last:numbers.at(-1),count:numbers.length}))});
 }
 console.log('CATALOG_NUMBERING_VERIFIED '+JSON.stringify(report));await catalog.db.$disconnect();
})().catch(e=>{console.error('Catalog numbering check failed:',e.name,String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]').slice(0,240));process.exit(1);});
