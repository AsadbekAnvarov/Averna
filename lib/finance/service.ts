import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { financeCommand } from "./commands";
import { FinanceError, money, positiveMoney, monthKey, localDay, todayTashkent, shareOf, refundShare, totals, type MoneyEntry } from "./rules";
type Tx=Prisma.TransactionClient;
export interface FinanceActor {id:string;name?:string|null;role?:string|null}
function admin(actor:FinanceActor) {if(actor.role!=="ADMIN")throw new FinanceError("Faqat administrator uchun.",403)}
const json=(x:unknown)=>x as Prisma.InputJsonValue;
const asMoney=(v:unknown)=>BigInt(String(v??0));
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
async function periodLock(tx:Tx,month:string) {
 await tx.$queryRaw`SELECT "id" FROM "finance_periods" WHERE "month"=${month} FOR UPDATE`;
 const p=await tx.financePeriod.findUnique({where:{month}});
 if(!p)throw new FinanceError("Avval oy oching.",409);
 if(p.status!=="OPEN")throw new FinanceError("Oy yopilgan. Bu oyga oʻzgartirish kiritilmaydi.",409);
 return p;
}
async function staffLock(tx:Tx,id:string) {
 await tx.$queryRaw`SELECT "id" FROM "finance_staff" WHERE "id"=${id} FOR UPDATE`;
 const staff=await tx.financeStaff.findUnique({where:{id}});
 if(!staff)throw new FinanceError("Xodim topilmadi.",404);return staff;
}
async function invoicePaid(tx:Tx,id:string) {
 const result=await tx.financeEntry.aggregate({where:{invoiceId:id},_sum:{amount:true}});return asMoney(result._sum.amount);
}
async function payrollAvailable(tx:Tx,staffId:string) {
 // Carry credits/advances over across every period, never clamp away an overadvance.
 const [e,p,a]=await Promise.all([
  tx.financeEntry.aggregate({where:{staffId},_sum:{earned:true}}),
  tx.financeEntry.aggregate({where:{staffId,OR:[{kind:{in:["ADVANCE","SALARY"]}},{kind:"REVERSAL",original:{kind:{in:["ADVANCE","SALARY"]}}}]},_sum:{amount:true}}),
  tx.financeAccrual.aggregate({where:{staffId},_sum:{amount:true}}),
 ]);return asMoney(e._sum.earned)+asMoney(p._sum.amount)+asMoney(a._sum.amount);
}
export async function financeSnapshot(actor:FinanceActor,month= todayTashkent().slice(0,7),client=db) {
 admin(actor);month=monthKey(month);
 const [period,staff,learners,leads,months,platformStudents,roster,teachers,legacyCount,legacyPayments]=await Promise.all([
  client.financePeriod.findUnique({where:{month}}),client.financeStaff.findMany({orderBy:{fullName:"asc"}}),
  client.financeLearner.findMany({orderBy:{fullName:"asc"}}),client.financeLead.findMany({orderBy:{createdAt:"desc"},take:200}),
  client.financePeriod.findMany({select:{month:true,status:true},orderBy:{month:"desc"},take:36}),
  client.student.findMany({select:{id:true,user:{select:{name:true}},group:{select:{name:true}}},orderBy:{createdAt:"desc"},take:1000}),
  client.rosterStudent.findMany({select:{id:true,fullName:true,group:{select:{name:true}}},take:1000}),
  client.teacher.findMany({select:{id:true,user:{select:{name:true}}},take:300}),client.payment.count(),
  client.payment.findMany({orderBy:{createdAt:"desc"},take:200,include:{student:{select:{user:{select:{name:true}}}}}}),
 ]);
 const [invoices,entries,accruals,allStaffEntries,allAccruals,refundSources]=await Promise.all([
  client.financeInvoice.findMany({where:{period:{month:{lte:month}}},include:{period:{select:{month:true}},entries:{select:{amount:true}}},orderBy:{learnerName:"asc"}}),
  period?client.financeEntry.findMany({where:{periodId:period.id},include:{original:{select:{kind:true}},reversal:{select:{id:true}},invoice:{select:{learnerName:true,groupName:true}},staff:{select:{fullName:true}}},orderBy:[{occurredAt:"desc"},{createdAt:"desc"}]}):[],
  period?client.financeAccrual.findMany({where:{periodId:period.id}}):[],
  client.financeEntry.findMany({where:{staffId:{not:null}},select:{staffId:true,amount:true,earned:true,kind:true,original:{select:{kind:true}}}}),
  client.financeAccrual.findMany({select:{staffId:true,amount:true}}),
  client.financeEntry.findMany({where:{kind:"TUITION",reversal:null},include:{invoice:{select:{learnerName:true}},refunds:{include:{reversal:true}}},orderBy:{occurredAt:"desc"}}),
 ]);
 const moneyEntries:MoneyEntry[]=entries.map(e=>({kind:e.kind,amount:e.amount.toString(),earned:e.earned.toString(),channel:e.channel,staffId:e.staffId,originalKind:e.original?.kind??null}));
 const opening=(period?.opening??{}) as Record<string,string>;
 const summary=totals(moneyEntries,opening,accruals.reduce((s,a)=>s+asMoney(a.amount),0n).toString());
 const inv=invoices.map(i=>{const paid=i.entries.reduce((s,e)=>s+asMoney(e.amount),0n);const remaining=asMoney(i.amount)-paid;return {id:i.id,month:i.period.month,learnerId:i.learnerId,name:i.learnerName,group:i.groupName,staff:i.staffName,amount:i.amount.toString(),paid:paid.toString(),remaining:remaining.toString(),dueDate:todayTashkent(i.dueAt),overdue:remaining>0n&&todayTashkent(i.dueAt)<todayTashkent(),shareBps:i.shareBps}});
 const payroll=staff.map(s=>{
  const current=moneyEntries.filter(e=>e.staffId===s.id);const total=allStaffEntries.filter(e=>e.staffId===s.id).map(e=>({...e,amount:e.amount.toString(),earned:e.earned.toString(),channel:"CASH",originalKind:e.original?.kind??null}));
  const m=totals(current,{},accruals.filter(a=>a.staffId===s.id).reduce((n,a)=>n+asMoney(a.amount),0n).toString());
  const lifetime=totals(total,{},allAccruals.filter(a=>a.staffId===s.id).reduce((n,a)=>n+asMoney(a.amount),0n).toString());
  const tuition=current.filter(e=>["TUITION","REFUND"].includes(e.kind==="REVERSAL"?e.originalKind??"":e.kind)).reduce((n,e)=>n+BigInt(e.amount),0n);
  const commission=current.reduce((n,e)=>n+BigInt(e.earned),0n);
  return {id:s.id,name:s.fullName,shareBps:s.shareBps,active:s.active,earned:m.payrollEarned,paid:m.payrollPaid,due:lifetime.payrollDue,tuition:tuition.toString(),commission:commission.toString(),centerShare:(tuition-commission).toString()};
 });
 return {
  actorId:actor.id, month,period:period?{status:period.status,opening,closedAt:period.closedAt?.toISOString()??null,closingSnapshot:period.closingSnapshot}:null,
  summary:{...summary,receivables:inv.reduce((s,i)=>s+(BigInt(i.remaining)>0n?BigInt(i.remaining):0n),0n).toString(),overdueCount:inv.filter(i=>i.overdue).length},
  months,staff:payroll,learners:learners.map(l=>({...l,monthlyFee:l.monthlyFee.toString(),enrolledOn:l.enrolledOn.toISOString(),createdAt:l.createdAt.toISOString()})),invoices:inv,
  entries:entries.map(e=>({id:e.id,kind:e.kind,amount:e.amount.toString(),earned:e.earned.toString(),channel:e.channel,category:e.category,description:e.description,date:todayTashkent(e.occurredAt),actor:e.actorName,staff:e.staff?.fullName??null,learner:e.invoice?.learnerName??null,reversed:!!e.reversal,refundOfId:e.refundOfId})),
  refundSources:refundSources.map(e=>({id:e.id,date:todayTashkent(e.occurredAt),learner:e.invoice?.learnerName??"",remaining:(asMoney(e.amount)+e.refunds.filter(r=>!r.reversal).reduce((s,r)=>s+asMoney(r.amount),0n)).toString()})).filter(e=>BigInt(e.remaining)>0n),
  accruals:accruals.map(a=>({id:a.id,staffId:a.staffId,amount:a.amount.toString(),reason:a.reason})),
  leads:leads.map(l=>({...l,appointmentAt:l.appointmentAt?todayTashkent(l.appointmentAt):null,createdAt:l.createdAt.toISOString()})),
  platformStudents:platformStudents.map(s=>({id:s.id,name:s.user.name??s.id,group:s.group?.name??""})),roster:roster.map(r=>({id:r.id,name:r.fullName,group:r.group.name})),teachers:teachers.map(t=>({id:t.id,name:t.user.name??t.id})),legacyCount,
  legacyPayments:legacyPayments.map(p=>({id:p.id,name:p.student.user.name??"",amount:String(p.amount),type:p.type,status:p.status,date:todayTashkent(p.createdAt),description:p.description??""})),
  coverage:{platformStudentsLimited:platformStudents.length===1000,rosterLimited:roster.length===1000,leadsLimited:leads.length===200},
 };
}
export type FinanceSnapshot=Awaited<ReturnType<typeof financeSnapshot>>;

export async function financeMutate(actor:FinanceActor,raw:unknown,key:string) {
 admin(actor);
 if(!/^[A-Za-z0-9_-]{16,80}$/.test(key))throw new FinanceError("Soʻrov kaliti notoʻgʻri.");
 const parsed=financeCommand.safeParse(raw);if(!parsed.success)throw new FinanceError("Maydonlarni tekshiring: "+parsed.error.issues[0]?.path.join("."));
 const c=parsed.data;const requestId=`${actor.id}:${key}`;const hash=createHash("sha256").update(canonical(c)).digest("hex");
 const previous=await db.financeRequest.findUnique({where:{id:requestId}});
 if(previous){if(previous.payloadHash!==hash)throw new FinanceError("Bu soʻrov kaliti boshqa maʼlumotga tegishli.",409);return previous.result}
 const result={ok:true,message:"Saqlandi."};
 try{return await db.$transaction(async tx=>{
  await tx.financeRequest.create({data:{id:requestId,actorId:actor.id,payloadHash:hash,result}});
  if(c.action==="OPEN_PERIOD"){
   const month=monthKey(c.month);const opening=Object.fromEntries(Object.entries(c.opening).map(([k,v])=>[k,money(v,true).toString()]));
   if(await tx.financePeriod.findUnique({where:{month}}))throw new FinanceError("Oy allaqachon ochilgan.",409);
   await tx.financePeriod.create({data:{month,opening:json(opening)}});
  } else if(c.action==="ADD_STAFF" || c.action==="UPDATE_STAFF") {
   if(!/^\d{1,3}(\.\d{1,2})?$/.test(c.sharePercent))throw new FinanceError("Ulush uchun 0–100% va koʻpi bilan 2 kasr raqami.");
   const bps=Math.round(Number(c.sharePercent)*100);shareOf(0n,bps);
   if(c.action==="ADD_STAFF"){
    if(c.platformTeacherId&&!await tx.teacher.findUnique({where:{id:c.platformTeacherId},select:{id:true}}))throw new FinanceError("Platforma oʻqituvchisi topilmadi.");
    await tx.financeStaff.create({data:{fullName:c.fullName,shareBps:bps,platformTeacherId:c.platformTeacherId||null}});
   }else {await staffLock(tx,c.id);await tx.financeStaff.update({where:{id:c.id},data:{shareBps:bps,active:c.active}})}
  } else if(c.action==="ADD_LEARNER" || c.action==="UPDATE_LEARNER") {
   const s=await staffLock(tx,c.staffId);if(!s.active)throw new FinanceError("Faol xodimni tanlang.");
   if(c.platformStudentId&&c.rosterStudentId)throw new FinanceError("Faqat bitta platforma yozuviga ulang.");
   let studentName:string|null=null;let groupName:string|null=null;
   if(c.platformStudentId){const student=await tx.student.findUnique({where:{id:c.platformStudentId},select:{user:{select:{name:true}},group:{select:{name:true}}}});if(!student)throw new FinanceError("Oʻquvchi topilmadi.");studentName=student.user.name;groupName=student.group?.name??null}
   if(c.rosterStudentId){const r=await tx.rosterStudent.findUnique({where:{id:c.rosterStudentId},select:{fullName:true,group:{select:{name:true}}}});if(!r)throw new FinanceError("Roʻyxat aʼzosi topilmadi.");studentName=r.fullName;groupName=r.group.name}
   const data={fullName:studentName||c.fullName,phone:c.phone||null,groupName:groupName||c.groupName,staffId:c.staffId,monthlyFee:money(c.monthlyFee).toString(),dueDay:c.dueDay,status:c.status,note:c.note||null,platformStudentId:c.platformStudentId||null,rosterStudentId:c.rosterStudentId||null,sourceKey:c.sourceKey||null};
   if(c.action==="ADD_LEARNER")await tx.financeLearner.create({data});else await tx.financeLearner.update({where:{id:c.id},data});
  } else if(c.action==="IMPORT_LEARNERS") {
   for(const item of c.items){
    if(!item.sourceKey||item.platformStudentId||item.rosterStudentId)throw new FinanceError("Import manba kaliti bilan, akkaunt yaratmasdan bajariladi.");
    const staff=await tx.financeStaff.findUnique({where:{id:item.staffId}});if(!staff?.active||staff.shareBps===null)throw new FinanceError("Importdagi xodim yoki ulush tasdiqlanmagan.");
    const fee=money(item.monthlyFee).toString();
    const existing=await tx.financeLearner.findUnique({where:{sourceKey:item.sourceKey}});
    if(existing){if(existing.fullName!==item.fullName||existing.staffId!==item.staffId||existing.groupName!==item.groupName||existing.monthlyFee.toString()!==fee||existing.dueDay!==item.dueDay||existing.phone!==(item.phone||null)||existing.status!==item.status||existing.note!==(item.note||null))throw new FinanceError("Manba kaliti mavjud, lekin maʼlumot o‘zgargan. Avval moslashtiring.",409);continue}
    const duplicate=await tx.financeLearner.findFirst({where:{fullName:item.fullName,groupName:item.groupName}});if(duplicate)throw new FinanceError("Ism va guruh allaqachon mavjud. Avval qoʻlda moslashtiring.",409);
    await tx.financeLearner.create({data:{fullName:item.fullName,phone:item.phone||null,groupName:item.groupName,staffId:item.staffId,monthlyFee:fee,dueDay:item.dueDay,status:item.status,note:item.note||null,sourceKey:item.sourceKey}});
   }
  } else if(c.action==="ADD_LEAD") {
   await tx.financeLead.create({data:{fullName:c.fullName,phone:c.phone,groupName:c.groupName||null,appointmentAt:c.appointmentDate?localDay(c.appointmentDate):null,note:c.note||null}});
  } else if(c.action==="UPDATE_LEAD") {
   await tx.financeLead.update({where:{id:c.id},data:{status:c.status,note:c.note||null}});
  } else {
   const month=monthKey(c.month);const period=await periodLock(tx,month);
   if(c.action==="BILL_LEARNERS"){
    const ids=[...new Set(c.learnerIds)];const learners=await tx.financeLearner.findMany({where:{id:{in:ids}},include:{staff:true}});
    if(learners.length!==ids.length)throw new FinanceError("Oʻquvchilar roʻyxatini yangilang.");
    for(const l of learners){
     if(l.status!=="ACTIVE"||!l.staff.active||l.staff.shareBps===null)throw new FinanceError("Faqat faol, ulushi belgilangan oʻquvchilar uchun hisob ochiladi.");
     const amount=positiveMoney(c.amount??l.monthlyFee.toString());
     if(await tx.financeInvoice.findUnique({where:{periodId_learnerId:{periodId:period.id,learnerId:l.id}}}))continue;
     await tx.financeInvoice.create({data:{periodId:period.id,learnerId:l.id,staffId:l.staffId,learnerName:l.fullName,groupName:l.groupName,staffName:l.staff.fullName,shareBps:l.staff.shareBps,amount:amount.toString(),dueAt:localDay(`${month}-${String(l.dueDay).padStart(2,"0")}`)}});
    }
   } else if(c.action==="ACCRUAL"){
    if(month>todayTashkent().slice(0,7))throw new FinanceError("Kelajak oyi uchun haqiqiy ish haqi hisoblanmaydi.");
    await staffLock(tx,c.staffId);const amount=money(c.amount,true);if(amount===0n)throw new FinanceError("Nol summa saqlanmaydi.");
    await tx.financeAccrual.create({data:{periodId:period.id,staffId:c.staffId,amount:amount.toString(),reason:c.reason,actorId:actor.id}});
   } else if(c.action==="POST_ENTRY"){
    const amount=positiveMoney(c.amount);const date=localDay(c.date);if(c.date.slice(0,7)!==month)throw new FinanceError("Operatsiya sanasi tanlangan oyga tegishli boʻlishi kerak.");
    if(c.date>todayTashkent())throw new FinanceError("Haqiqiy tushum/chiqim kelajak sanasiga yozilmaydi.");
    let sign=c.kind==="TUITION"||c.kind==="OTHER_INCOME"?1n:-1n;let earned=0n;let invoiceId:string|null=null;let staffId:string|null=null;let refundOfId:string|null=null;
    if(c.kind==="TUITION"){
     if(!c.invoiceId)throw new FinanceError("Oylik hisobni tanlang.");
     await tx.$queryRaw`SELECT "id" FROM "finance_invoices" WHERE "id"=${c.invoiceId} FOR UPDATE`;
     const invoice=await tx.financeInvoice.findUnique({where:{id:c.invoiceId},include:{period:{select:{month:true}}}});if(!invoice)throw new FinanceError("Hisob topilmadi.");
     if(invoice.period.month>month)throw new FinanceError("Kelajak oyi hisobini oldingi davrga toʻlab boʻlmaydi.");
     if(amount>asMoney(invoice.amount)-await invoicePaid(tx,invoice.id))throw new FinanceError("Toʻlov qolgan qarzdan oshdi. Oldindan keyingi oy uchun alohida hisob oching.");
     staffId=invoice.staffId;invoiceId=invoice.id;earned=shareOf(amount,invoice.shareBps);await staffLock(tx,staffId);
    } else if(c.kind==="ADVANCE"||c.kind==="SALARY"){
     if(!c.staffId)throw new FinanceError("Xodimni tanlang.");await staffLock(tx,c.staffId);staffId=c.staffId;
     if(c.kind==="SALARY"&&amount>await payrollAvailable(tx,staffId))throw new FinanceError("Ish haqi hisoblangan qoldiqdan oshdi. Oldindan toʻlovni avans sifatida yozing.");
    } else if(c.kind==="REFUND"){
     if(!c.refundOfId)throw new FinanceError("Asl kurs toʻlovini tanlang.");
     await tx.$queryRaw`SELECT "id" FROM "finance_entries" WHERE "id"=${c.refundOfId} FOR UPDATE`;
     const original=await tx.financeEntry.findUnique({where:{id:c.refundOfId},include:{reversal:true,invoice:true,period:{select:{month:true}},refunds:{include:{reversal:true}}}});
     if(!original||original.kind!=="TUITION"||original.reversal||!original.invoice)throw new FinanceError("Qaytarish uchun haqiqiy kurs tushumi kerak.");
     if(original.period.month>month||date<original.occurredAt)throw new FinanceError("Qaytarish asl toʻlovdan oldin yozilmaydi.");
     const refunds=original.refunds.filter(r=>!r.reversal);const refunded=refunds.reduce((s,r)=>s-asMoney(r.amount),0n);const earnedRefunded=refunds.reduce((s,r)=>s-asMoney(r.earned),0n);
     earned=-refundShare(asMoney(original.amount),asMoney(original.earned),refunded,earnedRefunded,amount,original.invoice.shareBps);
     await tx.$queryRaw`SELECT "id" FROM "finance_invoices" WHERE "id"=${original.invoiceId} FOR UPDATE`;
     invoiceId=original.invoiceId;staffId=original.staffId;refundOfId=original.id;if(staffId)await staffLock(tx,staffId);
    }
    if(c.kind==="EXPENSE"&&!c.category)throw new FinanceError("Xarajat turini tanlang.");
    await tx.financeEntry.create({data:{periodId:period.id,kind:c.kind,amount:(sign*amount).toString(),earned:earned.toString(),channel:c.channel,category:c.kind==="EXPENSE"?c.category:null,invoiceId,staffId,refundOfId,description:c.description,occurredAt:date,actorId:actor.id,actorName:actor.name??"Admin"}});
   } else if(c.action==="REVERSE_ENTRY"){
    await tx.$queryRaw`SELECT "id" FROM "finance_entries" WHERE "id"=${c.id} FOR UPDATE`;
    const original=await tx.financeEntry.findUnique({where:{id:c.id},include:{reversal:true,refunds:{include:{reversal:true}}}});
    if(!original||original.periodId!==period.id||original.kind==="REVERSAL"||original.reversal)throw new FinanceError("Operatsiyani bekor qilib boʻlmaydi.");
    if(original.refunds.some(r=>!r.reversal))throw new FinanceError("Avval faol qaytarish yozuvlarini tekshiring.");
    if(original.invoiceId)await tx.$queryRaw`SELECT "id" FROM "finance_invoices" WHERE "id"=${original.invoiceId} FOR UPDATE`;
    if(original.kind==="REFUND"&&original.invoiceId){
     const invoice=await tx.financeInvoice.findUnique({where:{id:original.invoiceId}});
     if(!invoice||await invoicePaid(tx,original.invoiceId)-asMoney(original.amount)>asMoney(invoice.amount))throw new FinanceError("Qaytarishni bekor qilish hisobda ortiqcha toʻlov yaratadi. Keyingi toʻlovlarni avval tekshiring.");
    }
    if(original.staffId)await staffLock(tx,original.staffId);
    await tx.financeEntry.create({data:{periodId:period.id,kind:"REVERSAL",amount:(-asMoney(original.amount)).toString(),earned:(-asMoney(original.earned)).toString(),channel:original.channel,category:original.category,invoiceId:original.invoiceId,staffId:original.staffId,reversesId:original.id,description:c.reason,occurredAt:original.occurredAt,actorId:actor.id,actorName:actor.name??"Admin"}});
   } else if(c.action==="CLOSE_PERIOD"){
    const entries=await tx.financeEntry.findMany({where:{periodId:period.id},include:{original:{select:{kind:true}}}});const accrual=await tx.financeAccrual.aggregate({where:{periodId:period.id},_sum:{amount:true}});
    const snapshot=totals(entries.map(e=>({kind:e.kind,amount:e.amount.toString(),earned:e.earned.toString(),channel:e.channel,staffId:e.staffId,originalKind:e.original?.kind??null})),period.opening as Record<string,string>,String(accrual._sum.amount??0));
    await tx.financePeriod.update({where:{id:period.id},data:{status:"CLOSED",closedAt:new Date(),closedBy:actor.id,closingSnapshot:json(snapshot)}});
   }
  }
  // Financial writes fail if the audit cannot commit; no best-effort audit here.
  await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.name??"Admin",role:"ADMIN",action:`Finance: ${c.action}`,detail:canonical({requestId,command:c})}});
  return result;
 },{timeout:20000,maxWait:10000})}catch(e){
  if(e instanceof FinanceError)throw e;
  if((e as {code?:string}).code==="P2002"){
   const saved=await db.financeRequest.findUnique({where:{id:requestId}});if(saved){if(saved.payloadHash!==hash)throw new FinanceError("Soʻrov kaliti mos kelmadi.",409);return saved.result}
   throw new FinanceError("Bu yozuv allaqachon mavjud. Roʻyxatni yangilang.",409);
  }throw e;
 }
}
