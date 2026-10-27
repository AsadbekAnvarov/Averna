/** "Who needs help today" — the dashboard card (docs/elegance-roadmap.md, idea 10). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, refresh: vi.fn(), replace: vi.fn() }) }));

import { NeedsHelpList, NEEDS_HELP_DONE_KEY } from "@/components/teacher/needs-help-list";
import { rankNeedsHelp, type StudentSignals } from "@/lib/teacher/needs-help";

const TODAY = "2026-10-26";
const student = (id: string, name: string, over: Partial<StudentSignals>): StudentSignals => ({
  id,
  userId: `u-${id}`,
  name,
  group: "IELTS B2",
  missedHomework: 0,
  daysInactive: 0,
  brokenStreak: 0,
  fallingSkills: [],
  forecast: null,
  weakKind: null,
  absences: 0,
  openReports: 0,
  waitingReview: null,
  ...over,
});
const rows = rankNeedsHelp([
  student("s1", "Aziza Karimova", { daysInactive: 6, missedHomework: 2 }),
  student("s2", "Bobur Aliyev", { weakKind: { kind: "matching-headings", label: "Matching headings", wrong: 4, of: 5 } }),
]);

beforeEach(() => {
  localStorage.clear();
  nav.push.mockReset();
});
afterEach(cleanup);

describe("<NeedsHelpList/>", () => {
  it("empty: a calm 'Everyone is on track today' card", () => {
    render(<NeedsHelpList rows={[]} todayKey={TODAY} students={12} aiDrafts={false} />);
    expect(screen.getByRole("heading", { name: "Who needs help today" })).toBeTruthy();
    expect(screen.getByText("Everyone is on track today")).toBeTruthy();
    expect(screen.queryAllByTestId("needs-help-row")).toHaveLength(0);
  });

  it("lists each student with reason chips and one-tap actions of 44 px on phones", () => {
    render(<NeedsHelpList rows={rows} todayKey={TODAY} students={12} aiDrafts={false} />);
    const items = screen.getAllByTestId("needs-help-row");
    expect(items).toHaveLength(2);
    const first = within(items[0]);
    expect(first.getByText("Aziza Karimova")).toBeTruthy();
    expect(first.getByText("Missed 2 homework")).toBeTruthy();
    expect(first.getByText("No activity for 6 days")).toBeTruthy();
    for (const name of ["Message Aziza Karimova", "Mini task for Aziza Karimova", "Open Aziza Karimova", "Done for today: Aziza Karimova"]) {
      const el = first.getByRole(name.startsWith("Open") ? "link" : "button", { name });
      expect(el.className).toContain("min-h-[44px]");
    }
    expect(first.getByRole("link", { name: "Open Aziza Karimova" }).getAttribute("href")).toBe("/teacher/learning-dna/s1");
  });

  it("'Done for today' hides the row until tomorrow (this device) and can be undone", () => {
    render(<NeedsHelpList rows={rows} todayKey={TODAY} students={12} aiDrafts={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Done for today: Aziza Karimova" }));
    expect(screen.getAllByTestId("needs-help-row")).toHaveLength(1);
    expect(screen.queryByText("Aziza Karimova")).toBeNull();
    expect(JSON.parse(localStorage.getItem(NEEDS_HELP_DONE_KEY)!)).toEqual({ day: TODAY, ids: ["s1"] });
    cleanup();

    // Same day: still hidden; the next day: back.
    render(<NeedsHelpList rows={rows} todayKey={TODAY} students={12} aiDrafts={false} />);
    expect(screen.queryByText("Aziza Karimova")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 done today" }));
    expect(screen.getByText("Aziza Karimova")).toBeTruthy();
    cleanup();
    localStorage.setItem(NEEDS_HELP_DONE_KEY, JSON.stringify({ day: TODAY, ids: ["s1"] }));
    render(<NeedsHelpList rows={rows} todayKey="2026-10-27" students={12} aiDrafts={false} />);
    expect(screen.getByText("Aziza Karimova")).toBeTruthy();
  });

  it("Message opens the thread with an editable template draft (no AI key)", () => {
    render(<NeedsHelpList rows={rows} todayKey={TODAY} students={12} aiDrafts={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Message Aziza Karimova" }));
    const url = new URL(nav.push.mock.calls[0][0], "https://averna.test");
    expect(url.pathname).toBe("/messages");
    expect(url.searchParams.get("with")).toBe("u-s1");
    expect(url.searchParams.get("draft")).toMatch(/^Hi Aziza, I noticed 2 homework tasks are overdue/);
  });

  it("shows 8 rows, then 'Show all (N)'", () => {
    const many = rankNeedsHelp(Array.from({ length: 11 }, (_, i) => student(`s${i}`, `Student ${String(i).padStart(2, "0")}`, { missedHomework: 1 })));
    render(<NeedsHelpList rows={many} todayKey={TODAY} students={11} aiDrafts={false} />);
    expect(screen.getAllByTestId("needs-help-row")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show all (11)" }));
    expect(screen.getAllByTestId("needs-help-row")).toHaveLength(11);
  });
});
