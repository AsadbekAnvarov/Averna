import { describe,it,expect,vi,beforeEach } from "vitest";
import { readFileSync } from "node:fs";
const m=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}));
import FinancePage from "@/app/admin/finance/page";
import { POST as importOld } from "@/app/api/admin/finance/import/route";
const source=(p:string)=>readFileSync(p,"utf8");
describe("accounting retired from administration",()=>{
 beforeEach(()=>{m.auth.mockResolvedValue({user:{id:"a",role:"ADMIN"}})});
 it("old page redirects safely without reading accounts",async()=>{await expect(FinancePage()).rejects.toThrow("redirect:/admin/dashboard");expect(source("app/admin/finance/page.tsx")).not.toContain("financeSnapshot");});
 it("old imports cannot write or preview accounts",async()=>{const r=await importOld(new Request("https://averna.test/api/admin/finance/import",{method:"POST",body:"csv"}));expect(r.status).toBe(410)});
 it.each(["components/layout/portal-navigation.ts","components/dashboard/mobile-nav.tsx","components/command-palette.tsx","components/admin/voice-control.tsx","components/admin/dashboard-tools.tsx","app/admin/dashboard/page.tsx"])("removes financial navigation from %s",p=>{expect(source(p)).not.toMatch(/href:\s*["']\/admin\/finance|tab=finance/)});
 it.each(["components/admin/attention-bar.tsx","lib/admin-intel.ts","lib/admin-analytics.ts"])("does not query finance in %s",p=>{expect(source(p)).not.toMatch(/db\.payment|incomeRows|pendingInvoiceBalances|financeIndicators|@\/lib\/finance/)});
 it("does not mount accounting components or business-health scores",()=>{const s=source("app/admin/dashboard/page.tsx");expect(s).not.toMatch(/<ExecutiveOverview|<FinanceSummary|<DashboardFinance/);for(const name of ["StudentRoster","AdminKpis","OutcomeKpis","TeacherWorkload","DashboardLeads"])expect(s).toContain(`<${name}`);});
 it("removes payment counts from admin Telegram summaries",()=>{expect(source("lib/telegram/reports.ts")).not.toContain("db.payment");expect(source("lib/telegram/messages.ts")).not.toContain("L.adminPayments(s.");});
});
