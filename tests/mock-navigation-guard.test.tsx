import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const m=vi.hoisted(()=>({path:"/dashboard",role:"STUDENT"}));
vi.mock("next/navigation",()=>({usePathname:()=>m.path,useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock("next-auth/react",()=>({useSession:()=>({data:{user:{role:m.role}}})}));
import { MockNavigationGuard } from "@/components/exam/mock-navigation-guard";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
beforeEach(()=>{m.path="/dashboard";m.role="STUDENT";vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({attemptId:"a"})}));});
describe("in-site Mock navigation restriction",()=>{
 it("covers other Averna pages and disables their controls",async()=>{const r=render(<MockNavigationGuard><button>Dashboard action</button></MockNavigationGuard>);await screen.findByRole("dialog");expect(screen.getByRole("link",{name:"Return to Mock"}).getAttribute("href")).toBe("/learning/mock-exam/a");expect((r.container.firstElementChild as HTMLElement).inert).toBe(true);});
 it("does not cover the current exam",async()=>{m.path="/learning/mock-exam/a";render(<MockNavigationGuard><p>Exam</p></MockNavigationGuard>);await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.queryByRole("dialog")).toBeNull();});
 it("does not affect teacher navigation",()=>{m.role="TEACHER";render(<MockNavigationGuard><p>Teacher</p></MockNavigationGuard>);expect(fetch).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).toBeNull();});
 it("releases pages after server confirms finish",async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({attemptId:null})} as Response);render(<MockNavigationGuard><p>Completed result</p></MockNavigationGuard>);await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.queryByRole("dialog")).toBeNull();});
 it("never abandons or submits on route change",async()=>{render(<MockNavigationGuard><p>Page</p></MockNavigationGuard>);await screen.findByRole("dialog");expect(vi.mocked(fetch).mock.calls.every(([url])=>String(url)==="/api/mock/active")).toBe(true);});
});
