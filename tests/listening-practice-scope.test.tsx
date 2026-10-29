import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ListeningPracticeScope } from "@/components/exam/listening-practice-scope";
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount(extra = {}) { return render(<ListeningPracticeScope testId="test/id" partCount={4} {...extra} />); }
function activate(link: HTMLElement) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  // Prevent jsdom navigation after observing whether the React handler cancelled it.
  let cancelled = false;
  const stop = () => { cancelled = event.defaultPrevented; event.preventDefault(); };
  document.addEventListener("click", stop, { once: true });
  fireEvent(link, event);
  return cancelled;
}
describe("Listening full/part practice scope", () => {
  it("offers a full paper and all four independently playable parts", () => {
    mount(); expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Full Listening" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Full Listening" }).getAttribute("href")).toBe("/learning/listening/test%2Fid");
    for (let n = 1; n <= 4; n++) expect(screen.getByRole("link", { name: `Part ${n}` }).getAttribute("href")).toBe(`/learning/listening/test%2Fid?part=${n - 1}`);
  });
  it("marks Part 2 selected and never reuses an attempt or homework ID", () => {
    mount({ partIndex: 1 }); expect(screen.getByRole("link", { name: "Part 2" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link").every(l => !l.getAttribute("href")?.match(/attempt=|hw=/))).toBe(true);
  });
  it("leaves the attempt unchanged when the student cancels switching", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false), beforeSwitch = vi.fn(); mount({ beforeSwitch });
    expect(activate(screen.getByRole("link", { name: "Part 2" }))).toBe(true);
    expect(confirm).toHaveBeenCalledOnce(); expect(beforeSwitch).not.toHaveBeenCalled();
  });
  it("flushes the current draft before a confirmed mode change", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true); const beforeSwitch = vi.fn(() => true); mount({ beforeSwitch });
    expect(activate(screen.getByRole("link", { name: "Part 3" }))).toBe(false); expect(beforeSwitch).toHaveBeenCalledOnce();
  });
  it("keeps the attempt open if saving fails", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true); mount({ beforeSwitch: () => false });
    expect(activate(screen.getByRole("link", { name: "Part 4" }))).toBe(true);
  });
  it("does not restart the selected mode or allow switches while submitting", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true); const view = mount();
    expect(activate(screen.getByRole("link", { name: "Full Listening" }))).toBe(true); expect(confirm).not.toHaveBeenCalled();
    view.rerender(<ListeningPracticeScope testId="test/id" partCount={4} disabled />);
    expect(activate(screen.getByRole("link", { name: "Part 2" }))).toBe(true); expect(confirm).not.toHaveBeenCalled();
  });
  it("does not offer fake part playback for an uncut recording", () => {
    mount({ wholeRecording: true }); expect(screen.queryByRole("link")).toBeNull(); expect(screen.getByText(/verified audio boundaries/)).toBeTruthy();
  });
  it("omits the mode selector for single-part papers", () => { mount({ partCount: 1 }); expect(screen.queryByRole("navigation")).toBeNull(); });
  it("does not mount practice mode changes in Mock or homework", () => {
    const source = readFileSync("components/exam/listening-exam-runner.tsx", "utf8");
    expect(source).toContain("scopeExtra={practice && !homeworkId");
    expect(source).toContain("wholeRecording={suppliedWhole && !hasPracticeParts}");
    expect(source).toContain("answers: answersRef.current");
    expect(readFileSync("app/learning/listening/[testId]/page.tsx", "utf8")).toContain('test.recordingMode === "whole" && !clientTest.parts.every(p => p.audio) ? null');
  });
});
