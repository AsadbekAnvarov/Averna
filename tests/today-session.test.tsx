/** The Today tab's Daily Session hero and the "Back to today's session" bar. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { DailyPlanFacts, TodayActivity } from "@/lib/session/daily-plan";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), pathname: "/learning/listening/x" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
  usePathname: () => nav.pathname,
}));

import { TodaySession } from "@/components/session/today-session";
import { SessionReturnBar } from "@/components/session/session-return-bar";

const NOW = Date.parse("2026-05-12T09:00:00+05:00");
const facts = (activities: TodayActivity[] = []): DailyPlanFacts => ({
  dayKey: "2026-05-12",
  now: NOW,
  seed: 3,
  targetBand: 7,
  dueWords: 12,
  homework: null,
  homeworkDoneToday: [],
  skills: [
    { skill: "READING", label: "Reading", sessions: 4, recentAvg: 7, daysSince: 1 },
    { skill: "LISTENING", label: "Listening", sessions: 4, recentAvg: 6.5, daysSince: 2 },
    { skill: "WRITING", label: "Writing", sessions: 4, recentAvg: 7, daysSince: 1 },
    { skill: "SPEAKING", label: "Speaking", sessions: 4, recentAvg: 7, daysSince: 1 },
  ],
  tasks: {
    READING: [{ title: "Reading Passage 2 — Bees", href: "/learning/reading/r1?part=1", minutes: 20 }],
    LISTENING: [{ title: "Listening Part 3 — Campus", href: "/learning/listening/l1?part=2", minutes: 10 }],
    WRITING: [{ title: "Writing Task 1 — report", href: "/learning/writing/task1", minutes: 20 }],
    SPEAKING: [
      { title: "One Speaking answer — AI examiner", href: "/learning/examiner", minutes: 5 },
      { title: "Full Speaking test — Set 4", href: "/learning/speaking-test/s4", minutes: 14 },
    ],
  },
  activities,
});

const REVIEWED: TodayActivity = { action: "SRS_REVIEW", count: 10 };
const LISTENED: TodayActivity = { action: "IELTS_TEST_COMPLETED", module: "LISTENING", score: 6 };
const hero = (f: DailyPlanFacts) => render(<TodaySession facts={f} firstName="Aziz" streak={4} greeting="Good morning" />);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<TodaySession/>", () => {
  it("fresh: greeting, Day N, an ordered plan and one Start button to step 1", () => {
    hero(facts());
    expect(screen.getByText("Good morning, Aziz")).toBeTruthy();
    expect(screen.getByText("Day 4")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Today's session" })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Today's session steps" });
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "0 of 2 steps done" })).toBeTruthy();
    const start = screen.getByRole("link", { name: "Start: Review 10 due words" });
    expect(start.getAttribute("href")).toBe("/flashcards?from=session");
    start.addEventListener("click", (e) => e.preventDefault()); // jsdom can't navigate
    fireEvent.click(start);
    expect(JSON.parse(sessionStorage.getItem("averna_session_step") ?? "{}")).toMatchObject({ step: 1, total: 2 });
  });

  it("partly done: the step is checked and Continue opens the next one", () => {
    hero(facts([REVIEWED]));
    expect(screen.getByRole("img", { name: "1 of 2 steps done" })).toBeTruthy();
    expect(screen.getByText("(done)")).toBeTruthy();
    const cont = screen.getByRole("link", { name: "Continue: Listening Part 3 — Campus" });
    expect(cont.getAttribute("href")).toBe("/learning/listening/l1?part=2&from=session");
    expect(screen.getByText("Your Listening is 0.5 below your 7.0 target.")).toBeTruthy();
  });

  it("all done: session complete with a small Do more link and no Continue", () => {
    hero(facts([REVIEWED, LISTENED]));
    expect(screen.getByRole("heading", { name: "Session complete — see you tomorrow" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Do more" }).getAttribute("href")).toBe("/studio");
    expect(screen.queryByRole("link", { name: /^(Continue|Start)/ })).toBeNull();
  });

  it("length picker: 20 min adds the bonus and is remembered on this device", () => {
    hero(facts());
    const twenty = screen.getByRole("radio", { name: "20 min" });
    expect(screen.getByRole("radio", { name: "10 min" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(twenty);
    expect(twenty.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem("averna_session_minutes")).toBe("20");
    expect(screen.getByText("Bonus: talk with a speaking partner")).toBeTruthy();
  });

  it("reads the saved length on mount", () => {
    localStorage.setItem("averna_session_minutes", "5");
    hero(facts());
    expect(screen.getByRole("radio", { name: "5 min" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("One Speaking answer — AI examiner")).toBeTruthy();
  });

  it("refreshes on return and announces a newly finished step", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ facts: facts([REVIEWED]) }) });
    vi.stubGlobal("fetch", fetcher);
    hero(facts());
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetcher).toHaveBeenCalledWith("/api/session/today?minutes=10", { cache: "no-store" });
    expect(screen.getByRole("status").textContent).toBe("Step done: Review 10 due words. 1 of 2 complete.");
  });
});

describe("<SessionReturnBar/>", () => {
  it("shows 'Today's session · step 2 of 3 — Back' on a page opened from the session", () => {
    nav.params = new URLSearchParams("part=2&from=session");
    sessionStorage.setItem("averna_session_step", JSON.stringify({ step: 2, total: 3, day: "2026-05-12" }));
    render(<SessionReturnBar />);
    const link = screen.getByRole("link", { name: /Today's session · step 2 of 3/ });
    expect(link.getAttribute("href")).toBe("/dashboard");
    expect(link.textContent).toContain("Back");
  });

  it("renders nothing without the param", () => {
    nav.params = new URLSearchParams("part=2");
    const { container } = render(<SessionReturnBar />);
    expect(container.innerHTML).toBe("");
  });
});
