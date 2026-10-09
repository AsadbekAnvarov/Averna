import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({period:vi.fn(),entries:vi.fn(),invoices:vi.fn(),accrual:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{financePeriod:{findMany:m.period},financeEntry:{findMany:m.entries},financeInvoice:{findMany:m.invoices},financeAccrual:{aggregate:m.accrual}}}));
import { financeIndicators,incomeRows,pendingInvoiceBalances } from "@/lib/finance/indicators";
describe("truthful register-backed dashboard indicators",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.period.mockResolvedValue([{month:"2026-10"},{month:"2026-09"}]);m.entries.mockResolvedValue([]);m.invoices.mockResolvedValue([]);m.accrual.mockResolvedValue({_sum:{amount:"0"}})});
 afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()});
 it("does not label an unopened month as available",async()=>{m.period.mockResolvedValue([]);expect(await financeIndicators(new Date("2026-10-08T12:00:00Z"))).toMatchObject({available:false,growth:null})});
 it("subtracts refunds, expenses and accrued salary, not cash salary twice",async()=>{m.entries.mockResolvedValue([
 {kind:"TUITION",amount:"500000",earned:"330000",channel:"CASH",occurredAt:new Date("2026-10-02T07:00:00Z")},
 {kind:"REFUND",amount:"-100000",earned:"-66000",channel:"CASH",occurredAt:new Date("2026-10-03T07:00:00Z")},
 {kind:"EXPENSE",amount:"-50000",earned:"0",channel:"CASH",occurredAt:new Date("2026-10-04T07:00:00Z")},
 {kind:"ADVANCE",amount:"-100000",earned:"0",channel:"CASH",occurredAt:new Date("2026-10-04T07:00:00Z")},
 ]);m.accrual.mockResolvedValue({_sum:{amount:"10000"}});expect(await financeIndicators(new Date("2026-10-08T12:00:00Z"))).toMatchObject({available:true,month:400000,cash:400000,expenses:50000,profit:76000})});
 it("uses Tashkent calendar month and prior month, not the server timezone",async()=>{await financeIndicators(new Date("2026-09-30T20:00:00Z"));expect(m.period.mock.calls[0][0].where.month.in).toEqual(["2026-10","2026-09"])});
 it("excludes invoices due today from overdue notifications",async()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));await pendingInvoiceBalances();expect(m.invoices.mock.calls[0][0].where.dueAt.lt.toISOString()).toBe("2026-10-07T19:00:00.000Z")});
 it("returns unavailable rather than a zero-income claim when schema reads fail",async()=>{vi.spyOn(console,"error").mockImplementation(()=>{});m.entries.mockRejectedValue({code:"P2021"});expect(await incomeRows(new Date())).toBeNull();expect(await financeIndicators()).toMatchObject({available:false,growth:null})});
});
