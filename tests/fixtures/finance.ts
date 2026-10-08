import type { FinanceSnapshot } from "@/lib/finance/service";
import { totals } from "@/lib/finance/rules";
/** Synthetic QA only. Never seeded, imported or rendered in production by default. */
export function financeFixture():FinanceSnapshot {
 const entries=[
  {id:"receipt-demo",kind:"TUITION",amount:"500000",earned:"330000",channel:"CASH",category:null,description:"Synthetic QA receipt",date:"2026-10-02",actor:"Test Admin",staff:"Teacher A",learner:"Learner A",reversed:false,refundOfId:null},
  {id:"expense-demo",kind:"EXPENSE",amount:"-50000",earned:"0",channel:"CASH",category:"BOOKS",description:"Synthetic books",date:"2026-10-03",actor:"Test Admin",staff:null,learner:null,reversed:false,refundOfId:null},
  {id:"advance-demo",kind:"ADVANCE",amount:"-100000",earned:"0",channel:"CASH",category:null,description:"Synthetic advance",date:"2026-10-04",actor:"Test Admin",staff:"Teacher A",learner:null,reversed:false,refundOfId:null},
 ];
 const opening={CASH:"1000000",CARD:"0",TERMINAL:"0",TRANSFER:"0"};
 const s=totals(entries.map(e=>({...e,staffId:e.staff?"staff-demo":null})),opening);
 return {actorId:"admin-test",month:"2026-10",period:{status:"OPEN",opening,closedAt:null,closingSnapshot:null},summary:{...s,receivables:"500000",overdueCount:1},months:[{month:"2026-10",status:"OPEN"}],staff:[{id:"staff-demo",name:"Teacher A",shareBps:6600,active:true,earned:"330000",paid:"100000",due:"230000",tuition:"500000",commission:"330000",centerShare:"170000"}],
 learners:["A","B"].map((n,i)=>({id:`learner-${n}`,fullName:`Learner ${n}`,phone:null,groupName:"Group A",platformStudentId:null,rosterStudentId:null,sourceKey:null,staffId:"staff-demo",monthlyFee:"500000",dueDay:5,status:"ACTIVE",enrolledOn:"2026-10-01T07:00:00.000Z",note:null,createdAt:"2026-10-01T07:00:00.000Z"})),
 invoices:["A","B"].map((n,i)=>({id:`invoice-${n}`,month:"2026-10",learnerId:`learner-${n}`,name:`Learner ${n}`,group:"Group A",staff:"Teacher A",amount:"500000",paid:i?"0":"500000",remaining:i?"500000":"0",dueDate:"2026-10-05",overdue:!!i,shareBps:6600})),entries,
 refundSources:[{id:"receipt-demo",date:"2026-10-02",learner:"Learner A",remaining:"500000"}],accruals:[],leads:[{id:"lead-demo",fullName:"Prospect A",phone:"test-contact",groupName:"Group A",status:"NEW",appointmentAt:"2026-10-09",note:null,createdAt:"2026-10-01T07:00:00.000Z"}],platformStudents:[],roster:[],teachers:[],legacyCount:0,legacyPayments:[],coverage:{platformStudentsLimited:false,rosterLimited:false,leadsLimited:false}};
}
