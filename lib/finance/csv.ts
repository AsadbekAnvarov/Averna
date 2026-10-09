import { FinanceError } from "./rules";
import { financeCommand } from "./commands";
/** Bounded RFC-style CSV parser; input is data, never formulas or executable content. */
export function csvRows(text:string):string[][] {
 if(text.length>100000)throw new FinanceError("CSV juda katta. Bir paketda 200 ta oʻquvchi.");
 text=text.replace(/^\uFEFF/,"");const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;let closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else {quoted=false;closed=true}}else field+=c;continue}
  if(c==='"'){if(field||closed)throw new FinanceError("CSV qoʻshtirnogʻi notoʻgʻri.");quoted=true;continue}
  if(c===","){row.push(field);field="";closed=false;continue}
  if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(s=>s.trim()))rows.push(row);row=[];field="";closed=false;continue}
  if(closed){if(c!==" ")throw new FinanceError("CSV ustunini tekshiring.")}else field+=c;
 }
 if(quoted)throw new FinanceError("CSV qoʻshtirnogʻi yopilmagan.");row.push(field);if(row.some(s=>s.trim()))rows.push(row);if(rows.length>201)throw new FinanceError("200 ta qatorlik paketdan oshdi.");return rows;
}
export function learnerCsv(text:string){
 const [header,...rows]=csvRows(text);const required=["fullName","phone","groupName","staffId","monthlyFee","dueDay","sourceKey"];
 if(!header||required.some(h=>!header.includes(h))||new Set(header).size!==header.length)throw new FinanceError("CSV sarlavhasi: "+required.join(","));
 const allowed=new Set([...required,"note","status"]);if(header.some(h=>!allowed.has(h)))throw new FinanceError("CSV nomaʼlum ustunlari bor.");
 const keys=new Set<string>();
 return rows.map((r,i)=>{
  if(r.length!==header.length)throw new FinanceError(`${i+2}-qator ustunlari mos emas.`);
  const raw=Object.fromEntries(header.map((h,j)=>[h,r[j].trim()]));if(!raw.sourceKey||keys.has(raw.sourceKey))throw new FinanceError(`${i+2}-qator manba kaliti yoʻq yoki takrorlangan.`);keys.add(raw.sourceKey);
  const parsed=financeCommand.safeParse({action:"ADD_LEARNER",...raw,status:raw.status||"ACTIVE",note:raw.note||""});
  if(!parsed.success||parsed.data.action!=="ADD_LEARNER")throw new FinanceError(`${i+2}-qator: ism, tarif, ulush va muddatni tekshiring.`);
  const {action,...item}=parsed.data;return item;
 });
}
