/** The Progress band forecast card and Today's "Path to 7.0" card. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SKILLS, type SkillKey } from "@/lib/engine/progression/config";
import type { ForecastInput, ForecastResult } from "@/lib/forecast/band-forecast";
import { BandForecastCard } from "@/components/forecast/band-forecast-card";
import { PathToTargetCard } from "@/components/forecast/path-to-target-card";

const DAY = 86_400_000;
const NOW = Date.parse("2026-05-12T09:00:00+05:00");
const r = (skill: SkillKey, daysAgo: number, band: number): ForecastResult => ({ skill, band, at: NOW - daysAgo * DAY });
const all = (series: [number, number][]) => SKILLS.flatMap((s) => series.map(([d, b]) => r(s, d, b)));
const input = (results: ForecastResult[]): ForecastInput => ({
  results,
  targetBand: 7,
  now: NOW,
  todayKey: "2026-05-12",
  pace: { READING: 1, LISTENING: 0.5, WRITING: 0.5, SPEAKING: 0.5 },
});
const RISING = input(all([[90, 5], [60, 5.5], [30, 5.5], [1, 6]]));
const FLAT = input(all([[40, 6], [20, 6], [2, 6]]));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("<BandForecastCard/>", () => {
  it("need-data: says what to take and links to that practice", () => {
    render(<BandForecastCard input={input([r("LISTENING", 3, 6)])} />);
    expect(screen.getByText("Not enough results yet")).toBeTruthy();
    const row = screen.getByTestId("forecast-LISTENING");
    expect(within(row).getByText("Take 1 more Listening test to see your forecast.")).toBeTruthy();
    expect(within(row).getByRole("link", { name: /Practise Listening/ }).getAttribute("href")).toBe("/learning/listening");
    expect(screen.getByText("Estimates from 1 result. Real exam conditions vary.")).toBeTruthy();
  });

  it("flat: shows the level and range but promises no date", () => {
    render(<BandForecastCard input={FLAT} />);
    expect(screen.getByText("≈ 6.0", { selector: "span.text-3xl" })).toBeTruthy();
    expect(screen.getByText(/No date for 7.0 at this pace yet/)).toBeTruthy();
    expect(within(screen.getByTestId("forecast-READING")).getByText(/^No upward trend in Reading yet\./)).toBeTruthy();
    expect(screen.queryByText(/At this pace 7.0 by/)).toBeNull();
  });

  it("rising: a dated path and an accessible sparkline with a text summary", () => {
    render(<BandForecastCard input={RISING} />);
    expect(screen.getByText(/^At this pace 7.0 by \d{1,2} [A-Z][a-z]+\.$/)).toBeTruthy();
    const spark = within(screen.getByTestId("forecast-READING")).getByRole("img");
    expect(spark.getAttribute("aria-label")).toMatch(/^Reading: 4 results, from 5.0 to 6.0; the dashed line projects 7.0 by/);
  });

  it("what-if: +2 a week moves the date earlier and announces it", () => {
    render(<BandForecastCard input={RISING} />);
    const before = screen.getByText(/^At this pace 7.0 by/).textContent;
    const live = screen.getByTestId("whatif-summary");
    expect(live.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("radio", { name: "2 extra sessions per skill" }));
    expect(screen.getByRole("radio", { name: "2 extra sessions per skill" }).getAttribute("aria-checked")).toBe("true");
    expect(live.textContent).toMatch(/^With 2 extra sessions per skill a week: 7.0 by .+ — \d+ (days|weeks) sooner \(estimate\)\.$/);
    expect(screen.getByText(/^At this pace 7.0 by/).textContent).not.toBe(before);
  });
});

describe("<PathToTargetCard/> (Today)", () => {
  it("shows the overall path and lets the student set the exam date", () => {
    render(<PathToTargetCard input={RISING} />);
    expect(screen.getByRole("heading", { name: "Path to 7.0" })).toBeTruthy();
    expect(screen.getByText(/^At this pace 7.0 by/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /See your forecast/ }).getAttribute("href")).toBe("/progress#forecast");
    fireEvent.click(screen.getByRole("button", { name: "Set your exam date" }));
    fireEvent.change(screen.getByLabelText("When is your IELTS exam?"), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(localStorage.getItem("averna_exam_date")).toBe("2026-12-15");
    expect(screen.getByText(/^Exam in 217 days — on track to reach it first\./)).toBeTruthy();
  });

  it("without enough results points to the missing practice", () => {
    localStorage.setItem("averna_exam_date", "2026-06-01");
    render(<PathToTargetCard input={input([r("READING", 10, 6), r("READING", 2, 6.5)])} />);
    expect(screen.getByText("Take 2 Listening tests to see your forecast.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Practise Listening/ }).getAttribute("href")).toBe("/learning/listening");
    expect(screen.getByText(/^Exam in 20 days\./)).toBeTruthy();
  });
});
