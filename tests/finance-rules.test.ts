import { describe,expect,it } from "vitest";
import { money,positiveMoney,shareOf,refundShare,totals,localDay,monthKey,safeCsvCell,todayTashkent } from "@/lib/finance/rules";
import { learnerCsv,csvRows } from "@/lib/finance/csv";
import { financeCommand } from "@/lib/finance/commands";
describe("exact finance rules",()=>{
 it.each(["NaN","1e6","12.50","-500","Infinity","1000000000001","",null])("rejects unsafe amounts %s",x=>expect(()=>money(x)).toThrow());
 it("supports exact signed adjustments and refuses zero receipts",()=>{expect(money("-500",true)).toBe(-500n);expect(()=>positiveMoney("0")).toThrow()});
 it.each([6600,7000,4000,0,10000])("conserves teacher/center money at %s bps",bps=>{const p=shareOf(500001n,bps);expect(p+(500001n-p)).toBe(500001n)});
 it("rounds commissions once to whole UZS",()=>{expect(shareOf(5n,6600)).toBe(3n);expect(shareOf(1n,5000)).toBe(1n)});
 it.each([-1,10001,66.6])("rejects invalid basis points",bps=>expect(()=>shareOf(100n,bps)).toThrow());
 it("final partial refund removes exactly the remaining accrued commission",()=>{expect(refundShare(3n,2n,2n,2n,1n,6600)).toBe(0n);expect(()=>refundShare(3n,2n,2n,2n,2n,6600)).toThrow()});
 it("distinguishes cash flow from accrued result without double-counting advances",()=>{const s=totals([
 {kind:"TUITION",amount:"500000",earned:"330000",channel:"CASH",staffId:"s"},
 {kind:"ADVANCE",amount:"-100000",earned:"0",channel:"CASH",staffId:"s"},
 {kind:"EXPENSE",amount:"-50000",earned:"0",channel:"CASH",staffId:null},
 ],{CASH:"1000000"});expect(s).toMatchObject({income:"500000",expenses:"50000",payrollEarned:"330000",payrollPaid:"100000",payrollDue:"230000",net:"350000",balance:"1350000",result:"120000"})});
 it("conserves channel flows against overall net",()=>{const s=totals([{kind:"OTHER_INCOME",amount:"7",earned:"0",channel:"CARD",staffId:null},{kind:"EXPENSE",amount:"-3",earned:"0",channel:"CASH",staffId:null}],{});expect(Object.values(s.channels).reduce((n,c)=>n+BigInt(c.flow),0n)).toBe(BigInt(s.net))});
 it("reverses money and payroll accrual without erasing original entries",()=>{const s=totals([{kind:"TUITION",amount:"100",earned:"66",channel:"TERMINAL",staffId:"s"},{kind:"REVERSAL",originalKind:"TUITION",amount:"-100",earned:"-66",channel:"TERMINAL",staffId:"s"}],{});expect(s.income).toBe("0");expect(s.payrollEarned).toBe("0")});
 it("retains excess advances as a negative payroll carryover",()=>expect(totals([{kind:"ADVANCE",amount:"-100",earned:"0",channel:"CASH",staffId:"s"}],{}).payrollDue).toBe("-100"));
 it.each(["2026-02-30","3132-01-21","2026-13-01","2026-10-00"])("rejects impossible dates",d=>expect(()=>localDay(d)).toThrow());
 it("uses Tashkent dates across UTC midnight",()=>{expect(todayTashkent(new Date("2026-10-07T20:00:00Z"))).toBe("2026-10-08");expect(monthKey("2026-10")).toBe("2026-10")});
 it.each(["=SUM(A1:A2)","+CMD","-CMD","@SUM(1)"])("neutralizes CSV formula injection",s=>expect(safeCsvCell(s)).toContain("'"));
 it("does not execute comma/quote/newline fields",()=>expect(csvRows('a,b\r\n"x,y","a""b"\r\n')).toEqual([["a","b"],["x,y",'a"b']]));
 it("validates import headers and stable provenance",()=>{const x='fullName,phone,groupName,staffId,monthlyFee,dueDay,sourceKey\nLearner A,,Group A,staff-a,500000,5,source-a';expect(learnerCsv(x)[0]).toMatchObject({monthlyFee:"500000",status:"ACTIVE"});expect(()=>learnerCsv(x+'\nLearner A,,Group A,staff-a,500000,5,source-a')).toThrow()});
 it.each(['a,b\n"unterminated',"a,b\nabc\"d,e"])("rejects malformed CSV",s=>expect(()=>csvRows(s)).toThrow());
 it("rejects forged actor/role fields at the command boundary",()=>expect(financeCommand.safeParse({action:"CLOSE_PERIOD",month:"2026-10",confirmation:"YOPISH",role:"ADMIN",actorId:"other"}).success).toBe(false));
});
