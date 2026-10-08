/** Read-only adapter for legacy dashboard widgets: finance register, never demo Payment rows. */
import { db } from "@/lib/db";
import { todayTashkent } from "./rules";
import type { Prisma } from "@prisma/client";
export const incomeWhere:Prisma.FinanceEntryWhereInput={OR:[{kind:{in:["TUITION","OTHER_INCOME","REFUND"]}},{kind:"REVERSAL",original:{kind:{in:["TUITION","OTHER_INCOME","REFUND"]}}}]};
export async function incomeRows(since:Date) {
 try{return (await db.financeEntry.findMany({where:{AND:[incomeWhere,{occurredAt:{gte:since}}]},select:{amount:true,occurredAt:true}})).map(e=>({amount:Number(e.amount),createdAt:e.occurredAt}))}
 catch(e){console.error("Finance indicators unavailable",{code:(e as {code?:string}).code});return null}
}
export async function pendingInvoiceBalances(){
 try{const invoices=await db.financeInvoice.findMany({where:{dueAt:{lt:new Date(`${todayTashkent()}T00:00:00+05:00`)}},select:{amount:true,entries:{select:{amount:true}}}});return invoices.map(i=>({amount:Number(BigInt(i.amount.toString())-i.entries.reduce((s,e)=>s+BigInt(e.amount.toString()),0n))})).filter(i=>i.amount>0)}catch{return null}
}
export async function financeIndicators(now=new Date()) {
 const day=todayTashkent(now);const month=day.slice(0,7);const [year,m]=month.split("-").map(Number);const prevMonth=new Date(Date.UTC(year,m-2,1)).toISOString().slice(0,7);const fromYear=`${day.slice(0,4)}-01-01`;const from=prevMonth+"-01"<fromYear?prevMonth+"-01":fromYear;
 try {
  const [periods,rows,invoices,accrual]=await Promise.all([
   db.financePeriod.findMany({where:{month:{in:[month,prevMonth]}},select:{month:true}}),
   db.financeEntry.findMany({where:{occurredAt:{gte:new Date(`${from}T00:00:00+05:00`)}},include:{original:{select:{kind:true}}}}),
   db.financeInvoice.findMany({where:{period:{month:{lte:month}}},select:{learnerId:true,amount:true,dueAt:true,entries:{select:{amount:true}}}}),
   db.financeAccrual.aggregate({where:{period:{month}},_sum:{amount:true}}),
  ]);
  const known=periods.some(p=>p.month===month);const income=rows.filter(e=>["TUITION","OTHER_INCOME","REFUND"].includes(e.kind==="REVERSAL"?e.original?.kind??"":e.kind));
  const sum=(a:typeof rows)=>{const value=Number(a.reduce((s,e)=>s+BigInt(e.amount.toString()),0n));if(!Number.isSafeInteger(value))throw new Error("Financial total exceeds numeric widget precision");return value};
  const thisMonth=rows.filter(e=>todayTashkent(e.occurredAt).slice(0,7)===month);const currentIncome=income.filter(e=>todayTashkent(e.occurredAt).slice(0,7)===month);
  const previousIncome=income.filter(e=>todayTashkent(e.occurredAt).slice(0,7)===prevMonth);const previousTotal=sum(previousIncome);const total=sum(currentIncome);
  const debtors=new Set(invoices.filter(i=>todayTashkent(i.dueAt)<day&&BigInt(i.amount.toString())>i.entries.reduce((s,e)=>s+BigInt(e.amount.toString()),0n)).map(i=>i.learnerId));
  const earned=thisMonth.reduce((s,e)=>s+BigInt(e.earned.toString()),BigInt(String(accrual._sum.amount??0)));const expenses=-sum(thisMonth.filter(e=>(e.kind==="REVERSAL"?e.original?.kind:e.kind)==="EXPENSE"));
  return {available:known,today:sum(income.filter(e=>todayTashkent(e.occurredAt)===day)),month:total,year:sum(income.filter(e=>todayTashkent(e.occurredAt).slice(0,4)===day.slice(0,4))),previous:previousTotal,growth:known&&periods.some(p=>p.month===prevMonth)&&previousTotal>0?Math.round((total-previousTotal)/previousTotal*100):null,cash:sum(currentIncome.filter(e=>e.channel==="CASH")),other:sum(currentIncome.filter(e=>e.channel!=="CASH")),debtors:debtors.size,pending:invoices.filter(i=>BigInt(i.amount.toString())>i.entries.reduce((s,e)=>s+BigInt(e.amount.toString()),0n)).length,expenses,profit:total-expenses-Number(earned)};
 }catch(e){console.error("Finance indicators unavailable",{code:(e as {code?:string}).code});return {available:false,today:0,month:0,year:0,previous:0,growth:null,cash:0,other:0,debtors:0,pending:0,expenses:0,profit:0}}
}
