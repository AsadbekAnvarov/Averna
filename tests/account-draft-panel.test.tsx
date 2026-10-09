import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDraftPanel, useAccountDraft } from "@/components/learning/account-draft-panel";
const remote = { essay: "An essay from another device", attemptId: "remote-123", timeLeft: 200, version: 2, updatedAt: "2026-10-09T12:00:00Z" };
function Harness({ restore, enabled = true }: { restore: (draft: typeof remote) => void; enabled?: boolean }) {
  const draft = useAccountDraft({ enabled, taskType: "task2", promptId: "topic", essay: "My local text", attemptId: "local-123", timeLeft: 100, restore });
  return <AccountDraftPanel draft={draft} disabled={false} />;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("explicit safe account draft controls", () => {
  it("recovers the initial read after a StrictMode effect restart", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({draft:null}))));
    render(<StrictMode><Harness restore={vi.fn()} /></StrictMode>);
    await waitFor(() => expect(screen.getByText(/No saved account text/)).toBeTruthy());
    expect((screen.getByRole("button", {name:"Save to account"}) as HTMLButtonElement).disabled).toBe(false);
  });
  it("does nothing when disabled", () => { const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<Harness restore={vi.fn()} enabled={false} />); expect(fetch).not.toHaveBeenCalled(); expect(screen.queryByText("Save to account")).toBeNull(); });
  it("never silently replaces local text and requires comparison", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ draft: remote }))));
    const restore = vi.fn(); render(<Harness restore={restore} />);
    await waitFor(() => expect(screen.getByText(/Account copy found/)).toBeTruthy());
    expect(restore).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: "Save to account" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Compare / restore" }));
    expect((screen.getByRole("button", { name: "Load account copy" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Load account copy" })); expect(restore).toHaveBeenCalledWith(remote);
  });
  it("preserves local text on failed requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline; device text unchanged")));
    const restore = vi.fn(); render(<Harness restore={restore} />); await waitFor(() => expect(screen.getByText(/Offline; device/)).toBeTruthy()); expect(restore).not.toHaveBeenCalled();
  });
  it("conflicts require a reload before a second write", async () => {
    const fetch = vi.fn().mockImplementation(async (_url, init) => init.method === "GET" ? new Response(JSON.stringify({ draft: null })) : new Response(JSON.stringify({ error: "Another device saved first" }), { status: 409 }));
    vi.stubGlobal("fetch", fetch); render(<Harness restore={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/No saved account text/)).toBeTruthy()); fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(screen.getByText(/Another device saved first/)).toBeTruthy()); expect((screen.getByRole("button", { name: "Save to account" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
