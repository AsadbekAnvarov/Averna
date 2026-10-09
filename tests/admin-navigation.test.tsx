import { cleanup,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({query:""}));
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(m.query)}));
import { PanelTabs } from "@/components/panel-tabs";
import { ADMIN_DASHBOARD_TABS,ADMIN_TAB_ALIASES } from "@/components/admin/dashboard-navigation";
const content={overview:<p>Overview content</p>,people:<p>People content</p>,finance:<p>Finance content</p>,insights:<p>Tools content</p>};
function shell(){return <PanelTabs tabs={ADMIN_DASHBOARD_TABS} aliases={ADMIN_TAB_ALIASES} wrapOnMobile content={content} storageKey="admin-test"/>}
describe("simplified admin navigation",()=>{
 beforeEach(()=>{sessionStorage.clear();m.query=""});afterEach(cleanup);
 it("keeps four distinct primary tasks instead of a duplicate manage tab",()=>{render(shell());expect(screen.getAllByRole("button")).toHaveLength(4);expect(screen.queryByRole("button",{name:"Boshqarish"})).toBeNull();expect(screen.getByRole("button",{name:"Oʻquvchilar va qabul"})).toBeTruthy()});
 it("preserves old manage deep links through the tools alias",async()=>{m.query="tab=manage";render(shell());await waitFor(()=>expect(screen.getByRole("button",{name:"Tahlil va vositalar"}).getAttribute("aria-current")).toBe("page"));expect(sessionStorage.getItem("admin-test")).toBe("insights")});
 it("restores a remembered manage tab to the retained tools section",async()=>{sessionStorage.setItem("admin-test","manage");render(shell());await waitFor(()=>expect(screen.getByRole("button",{name:"Tahlil va vositalar"}).getAttribute("aria-current")).toBe("page"))});
 it("does not overlay mobile forms with the two-row primary tab bar",()=>{const {container}=render(shell());expect(container.querySelector('div[class*="sm:sticky"]')?.className).toContain("relative sm:sticky")});

});
