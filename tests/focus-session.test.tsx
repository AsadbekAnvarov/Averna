import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FocusSession } from "@/components/study/focus-session";
import { nextFocusPlan } from "@/lib/study/next-session";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("short session guide", () => {
  it("advances a self-reported checklist without issuing learning or XP requests", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(
      <FocusSession
        plan={nextFocusPlan(
          { weakest: null, confidence: "insufficient", dataPoints: 0 },
          0,
        )}
      />,
    );
    for (let step = 0; step < 3; step++)
      fireEvent.click(
        screen.getByRole("button", { name: "I practised this step" }),
      );
    expect(
      screen.getByText("One focused session. One next step."),
    ).toBeTruthy();
    expect(screen.getByText(/the timer itself earns no XP/)).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
