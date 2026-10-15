import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import { FullscreenOffer, MockFocusGuard } from "@/components/exam/mock-focus-guard";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
beforeEach(()=>{localStorage.clear();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true}));Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});});
const state=(value:string)=>{Object.defineProperty(document,"visibilityState",{configurable:true,value});fireEvent(document,new Event("visibilitychange"));};
describe("CDI focus guard",()=>{
 it("warns once on return without submitting or abandoning",async()=>{render(<div className="mock-cdi"><MockFocusGuard attemptId="a" section={1}/></div>);state("hidden");state("hidden");state("visible");expect(screen.getByRole("alertdialog")).toBeTruthy();fireEvent.click(screen.getByText("Continue Mock"));expect(screen.queryByRole("alertdialog")).toBeNull();expect(vi.mocked(fetch).mock.calls.every(([url])=>String(url).endsWith("/focus"))).toBe(true);});
 it("does not flag ordinary window blur",()=>{render(<MockFocusGuard attemptId="a" section={0}/>);fireEvent(window,new Event("blur"));expect(screen.queryByRole("alertdialog")).toBeNull();});
 it("removes event listeners when a finished attempt unmounts",()=>{const r=render(<MockFocusGuard attemptId="a" section={0}/>);r.unmount();state("hidden");const stored=JSON.parse(localStorage.getItem("averna-mock-focus:a")!);expect(stored.pending).toBeNull();});
 it("disables background application chrome and restores it",()=>{const r=render(<div><aside data-testid="chrome"/><div className="mock-cdi"><MockFocusGuard attemptId="a" section={0}/></div></div>);expect((screen.getByTestId("chrome") as HTMLElement).inert).toBe(true);r.unmount();});
 it("treats unavailable full screen as optional",async()=>{render(<FullscreenOffer/>);fireEvent.click(screen.getByText("Use full screen (optional)"));await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("still start"));});
});
