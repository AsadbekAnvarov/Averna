import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: mocks.session }));
import { useOwnedMistakes } from "@/components/learning/use-owned-mistakes";
const card = { id: "own-card", wrong: "I have went", right: "I have been", note: null };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
describe("game correction source", () => {
  it("never reads the shared legacy bank or another account's cache", () => {
    localStorage.setItem("averna_mistakes_v1", JSON.stringify([card]));
    localStorage.setItem("averna_mistakes_v2:u1", JSON.stringify([card]));
    mocks.session.mockReturnValue({ data: { user: { id: "u2" } }, status: "authenticated" });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useOwnedMistakes());
    expect(result.current.items).toEqual([]);
  });
  it("drops previous-account content immediately on an identity change", async () => {
    mocks.session.mockReturnValue({ data: { user: { id: "u1" } }, status: "authenticated" });
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items: [card] }) }).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender } = renderHook(() => useOwnedMistakes());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.session.mockReturnValue({ data: { user: { id: "u2" } }, status: "authenticated" });
    rerender(); expect(result.current.items).toEqual([]); expect(result.current.owner).toBe("u2");
  });
});
