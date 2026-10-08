import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { formatUzs } from "@/lib/finance/rules";
import { webcrypto } from "node:crypto";
import { FinanceCenter } from "@/components/admin/finance/finance-center";
import { financeFixture } from "./fixtures/finance";
const response=(body:unknown,status=200)=>({ok:status<400,json:async()=>body});
describe("finance admin workspace",()=>{
 beforeEach(()=>{sessionStorage.clear();Object.defineProperty(globalThis,"crypto",{value:webcrypto,configurable:true});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response(financeFixture())))});
 afterEach(()=>{cleanup();vi.unstubAllGlobals()});
 it("separates cash balance, salary liability and result",()=>{render(<FinanceCenter initial={financeFixture()}/>);expect(screen.getAllByText(/1[\s,]350[\s,]000 UZS/)[0]).toBeTruthy();expect(screen.getByText(/120[\s,]000 UZS/)).toBeTruthy();expect(screen.getByRole("navigation",{name:"Moliyaviy boʻlimlar"})).toBeTruthy()});
 it("does not present unknown month balances as zero",()=>{const data=financeFixture();data.period=null;render(<FinanceCenter initial={data}/>);expect(screen.queryByText(/1[\s,]350[\s,]000 UZS/)).toBeNull();expect(screen.getAllByText("— UZS").length).toBeGreaterThan(3);expect((screen.getByRole("button",{name:/Kurs toʻlovini yozish/}) as HTMLButtonElement).disabled).toBe(true)});
 it("blocks monetary form submission on a closed period",()=>{const data=financeFixture();data.period!.status="CLOSED";render(<FinanceCenter initial={data}/>);fireEvent.click(screen.getByRole("button",{name:"Ish haqi"}));expect((screen.getByRole("button",{name:/Avansni yozish/}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:/Ish haqini yozish/}) as HTMLButtonElement).disabled).toBe(true)});
 it("shows payroll debt and center share in mobile-friendly cards",()=>{const {container}=render(<FinanceCenter initial={financeFixture()}/>);fireEvent.click(screen.getByRole("button",{name:"Ish haqi"}));expect(container.querySelector(".finance-mobile-cards")?.textContent).toContain(`${formatUzs("230000")} UZS`);expect(container.querySelector(".finance-mobile-cards")?.textContent).toContain(`${formatUzs("170000")} UZS`)});
 it("searches learners and applies invoice-debt filtering",()=>{render(<FinanceCenter initial={financeFixture()}/>);fireEvent.click(screen.getByRole("button",{name:"Oʻquvchilar"}));fireEvent.click(screen.getByRole("checkbox",{name:"Faqat qarzi bor"}));expect(screen.queryByRole("checkbox",{name:"Learner A uchun hisob tanlash"})).toBeNull();expect(screen.getByRole("checkbox",{name:"Learner B uchun hisob tanlash"})).toBeTruthy();fireEvent.change(screen.getByRole("textbox",{name:"Oʻquvchini qidirish"}),{target:{value:"absent"}});expect(screen.queryByRole("checkbox",{name:"Learner B uchun hisob tanlash"})).toBeNull()});
 it("preserves entered fields and reuses a private retry key after failure",async()=>{
 const fetchMock=vi.mocked(fetch);fetchMock.mockResolvedValue(response({error:"Synthetic service unavailable"},503) as Response);
 const {container}=render(<FinanceCenter initial={financeFixture()}/>);fireEvent.click(screen.getByRole("button",{name:"Xarajatlar"}));const form=container.querySelector("form")!;const amount=form.querySelector('input[name="amount"]') as HTMLInputElement;const description=form.querySelector('input[name="description"]') as HTMLInputElement;
 fireEvent.change(amount,{target:{value:"123456"}});fireEvent.change(description,{target:{value:"Private test memo"}});fireEvent.submit(form);
 await screen.findByText("Synthetic service unavailable");expect(amount.value).toBe("123456");expect(description.value).toBe("Private test memo");
 const storageKey=sessionStorage.key(0)!;expect(storageKey).toMatch(/^averna:finance:admin-test:[a-f0-9]{64}$/);expect(sessionStorage.getItem(storageKey)).not.toContain("Private test memo");
 const first=fetchMock.mock.calls[0][1]!.headers as Record<string,string>;fireEvent.submit(form);await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));expect((fetchMock.mock.calls[1][1]!.headers as Record<string,string>)["Idempotency-Key"]).toBe(first["Idempotency-Key"]);
 });
});
