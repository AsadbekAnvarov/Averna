import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MistakeBank } from "@/components/learning/mistake-bank";
const card = {
  id: "private-card",
  wrong: "I have went",
  right: "I have been",
  note: null,
  sourceTestId: null,
  practiceCount: 0,
  lastPracticedAt: null,
  createdAt: "2026-10-08",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
beforeEach(() => localStorage.clear());
describe("correction studio account isolation", () => {
  it("does not auto-import the old shared browser bank", async () => {
    localStorage.setItem(
      "averna_mistakes_v1",
      JSON.stringify([{ id: "m-1", wrong: "went", right: "been" }]),
    );
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => ({ items: url.includes("/srs/") ? {} : [] }),
    }));
    vi.stubGlobal("fetch", fetcher);
    render(<MistakeBank userId="u1" />);
    await screen.findByText("These are mine — import into my account");
    await waitFor(() =>
      expect(screen.getByText("Saved to your account")).toBeTruthy(),
    );
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
    expect(localStorage.getItem("averna_mistakes_v1")).not.toBeNull();
  });
  it("does not restore another account's local correction cache", async () => {
    localStorage.setItem("averna_mistakes_v2:u1", JSON.stringify([card]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Offline");
      }),
    );
    render(<MistakeBank userId="u2" />);
    await screen.findByText("Offline");
    fireEvent.click(screen.getByRole("button", { name: "My bank · 0" }));
    expect(screen.queryByText(card.wrong)).toBeNull();
  });
  it("keeps the owner's cached content visible when sync fails", async () => {
    localStorage.setItem("averna_mistakes_v2:u1", JSON.stringify([card]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Offline");
      }),
    );
    render(<MistakeBank userId="u1" />);
    await screen.findByText("Offline");
    fireEvent.click(screen.getByRole("button", { name: "My bank · 1" }));
    expect(screen.getByText(card.wrong)).toBeTruthy();
    expect(localStorage.getItem("averna_mistakes_v2:u1")).toContain(card.id);
  });
});
