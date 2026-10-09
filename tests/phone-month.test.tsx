import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhoneMonth } from "@/components/calendar/phone-month";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
const props = { basePath: "/calendar", year: 2026, month: 9, todayDay: 9, selectedDay: 9, items: {
  9: [{ kind: "lesson" as const, label: "Today's lesson" }],
  16: [{ kind: "homework" as const, label: "Full homework title for selected day" }],
} };
beforeEach(() => window.history.replaceState(null, "", "/calendar"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("URL-driven phone calendar", () => {
  it("selects a day without a server navigation and preserves its real href", () => {
    const { rerender } = render(<PhoneMonth {...props} />);
    const day = screen.getByRole("link", { name: "October 16, 1 scheduled" });
    expect(day.getAttribute("href")).toBe("/calendar?m=2026-10&d=16");
    const push = vi.spyOn(window.history, "pushState");
    fireEvent.click(day);
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?m=2026-10&d=16");
    rerender(<PhoneMonth {...props} />);
    expect(day.getAttribute("aria-current")).toBe("date");
    expect(screen.getByText(/Full homework title for selected day/)).toBeTruthy();
    fireEvent.click(day);
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("uses URL state after reload and history changes", () => {
    window.history.replaceState(null, "", "/calendar?m=2026-10&d=16");
    const { rerender } = render(<PhoneMonth {...props} selectedDay={16} />);
    expect(screen.getByText("Friday, October 16")).toBeTruthy();
    window.history.replaceState(null, "", "/calendar?m=2026-10&d=9");
    rerender(<PhoneMonth {...props} selectedDay={16} />);
    expect(screen.getByText("Friday, October 9")).toBeTruthy();
  });
  it("retains normal modified-click behaviour for opening another tab", () => {
    render(<PhoneMonth {...props} />);
    const push = vi.spyOn(window.history, "pushState");
    const cancelNavigation = (event: Event) => event.preventDefault();
    window.addEventListener("click", cancelNavigation, { once: true });
    fireEvent.click(screen.getByRole("link", { name: "October 16, 1 scheduled" }), { ctrlKey: true });
    expect(push).not.toHaveBeenCalled();
  });
  it("keeps teacher day links in their own calendar", () => {
    window.history.replaceState(null, "", "/teacher/calendar");
    render(<PhoneMonth {...props} basePath="/teacher/calendar" />);
    fireEvent.click(screen.getByRole("link", { name: "October 16, 1 scheduled" }));
    expect(window.location.pathname).toBe("/teacher/calendar");
    expect(window.location.search).toBe("?m=2026-10&d=16");
  });
  it("clamps malformed and out-of-month day parameters", () => {
    window.history.replaceState(null, "", "/calendar?d=999");
    const { rerender } = render(<PhoneMonth {...props} />);
    expect(screen.getByText("Saturday, October 31")).toBeTruthy();
    window.history.replaceState(null, "", "/calendar?d=invalid");
    rerender(<PhoneMonth {...props} />);
    expect(screen.getByText("Friday, October 9")).toBeTruthy();
  });
});
