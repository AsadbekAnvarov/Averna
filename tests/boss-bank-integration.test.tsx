import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ bank: vi.fn() }));
vi.mock("@/components/learning/use-owned-mistakes", () => ({ useOwnedMistakes: mocks.bank }));
import { BossBattle } from "@/components/dashboard/boss-battle";
afterEach(() => { cleanup(); localStorage.clear(); });
describe("Boss Battle uses the cloud-owned bank", () => {
  it("starts with account corrections instead of requiring a legacy local key", async () => {
    mocks.bank.mockReturnValue({ owner: "u1", loading: false, items: [1, 2, 3, 4].map((n) => ({ id: `card-${n}`, wrong: `wrong-${n}`, right: `right-${n}` })) });
    render(<BossBattle />);
    fireEvent.click(await screen.findByRole("button", { name: "Enter Battle" }));
    expect(screen.getByText(/^wrong-[1-4]$/)).toBeTruthy();
    expect(localStorage.getItem("averna_mistakes_v1")).toBeNull();
  });
});
