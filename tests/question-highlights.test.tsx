import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/components/exam/mock-cdi-interface", () => ({ useMockCdi: () => null }));
import { QuestionHighlights, questionText, questionRange, editQuestionHighlights, clearQuestionHighlights, questionHighlightKey } from "@/components/exam/question-highlights";

const registry = new Map<string, unknown>();
beforeEach(() => {
  localStorage.clear(); registry.clear();
  vi.stubGlobal("CSS", { highlights: registry });
  vi.stubGlobal("Highlight", class { ranges: Range[]; constructor(...ranges: Range[]) { this.ranges = ranges; } });
  Range.prototype.getBoundingClientRect = () => ({ x: 20, y: 30, top: 30, bottom: 50, left: 20, right: 120, width: 100, height: 20, toJSON() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.getSelection()?.removeAllRanges(); });
function content(scope = "reading:one", attemptId = "attempt") {
  return <QuestionHighlights attemptId={attemptId} scope={scope}><p data-testid="copy">The <b>early invention</b> used ultraviolet light.</p><input aria-label="Answer" defaultValue="answer" /><select aria-label="Choice"><option>Choose an option</option></select><button>Flag question</button></QuestionHighlights>;
}
function choose(start = 4, end = 19) {
  const el = screen.getByTestId("copy");
  const { runs } = questionText(el);
  const r = questionRange(runs, start, end)!;
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(r);
  fireEvent(document, new Event("selectionchange"));
}
async function highlight(color = "Yellow") {
  choose();
  await screen.findByRole("toolbar", { name: "Question highlight tools" });
  fireEvent.click(screen.getByRole("button", { name: `${color} highlight` }));
  fireEvent.click(screen.getByRole("button", { name: "Highlight" }));
}

describe("question highlighting", () => {
  it("maps question copy across inline formatting but excludes controls and hidden labels", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p>The <b>early invention</b> used <input value="answer">ultraviolet <select><option>Words</option></select>light.</p><button>Flag</button><span aria-hidden="true">Icon</span><span class="sr-only">Hidden</span>';
    const { text, runs } = questionText(root);
    expect(text).toBe("The early invention used ultraviolet light.");
    expect(questionRange(runs, 4, 19)?.toString()).toBe("early invention");
  });
  it("splits overlapping colour/removal changes without losing adjacent highlights", () => {
    const source = [{ from: 0, to: 10, quote: "abcdefghij", color: "blue" as const }];
    expect(editQuestionHighlights(source, { from: 3, to: 7 }, "abcdefghij", "pink")).toEqual([
      { from: 0, to: 3, quote: "abc", color: "blue" }, { from: 3, to: 7, quote: "defg", color: "pink" }, { from: 7, to: 10, quote: "hij", color: "blue" },
    ]);
    expect(editQuestionHighlights(source, { from: 0, to: 10 }, "abcdefghij")).toEqual([]);
  });
  it("adds a selected question highlight and persists chosen colour without changing answer controls", async () => {
    render(content()); await highlight("Blue");
    const stored = JSON.parse(localStorage.getItem(questionHighlightKey("attempt"))!);
    expect(stored["reading:one"]).toEqual([{ from: 4, to: 19, quote: "early invention", color: "blue" }]);
    expect((screen.getByRole("textbox", { name: "Answer" }) as HTMLInputElement).value).toBe("answer");
    expect(screen.getByRole("combobox", { name: "Choice" }).textContent).toBe("Choose an option");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });
  it("restores ranges after remount and keeps passages and attempts isolated", async () => {
    const view = render(content()); await highlight();
    view.rerender(content("reading:two"));
    await waitFor(() => expect([...registry.values()].every(x => (x as { ranges: Range[] }).ranges.length === 0)).toBe(true));
    view.rerender(content("reading:one"));
    await waitFor(() => expect([...registry.values()].some(x => (x as { ranges: Range[] }).ranges.length === 1)).toBe(true));
    view.rerender(content("reading:one", "different"));
    await waitFor(() => expect([...registry.values()].every(x => (x as { ranges: Range[] }).ranges.length === 0)).toBe(true));
    expect(JSON.parse(localStorage.getItem(questionHighlightKey("attempt"))!)["reading:one"]).toHaveLength(1);
  });
  it("removes a selected highlight and clears saved data on successful submit", async () => {
    render(content()); await highlight(); choose();
    await screen.findByRole("button", { name: "Remove" });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(localStorage.getItem(questionHighlightKey("attempt"))).toBeNull();
    localStorage.setItem(questionHighlightKey("attempt"), "{}"); clearQuestionHighlights("attempt");
    expect(localStorage.getItem(questionHighlightKey("attempt"))).toBeNull();
  });
  it("rejects corrupt persisted ranges and stale question text", async () => {
    localStorage.setItem(questionHighlightKey("attempt"), JSON.stringify({ "reading:one": [null, {from:-1,to:4}, {from:0,to:3,quote:"OLD",color:"yellow"}] }));
    render(content());
    await waitFor(() => expect(registry.size).toBe(4));
    expect([...registry.values()].every(x => (x as { ranges: Range[] }).ranges.length === 0)).toBe(true);
  });
  it("handles unavailable storage and unsupported Highlight API without crashing", async () => {
    vi.stubGlobal("CSS", {});
    render(content()); await highlight();
    expect(screen.getByRole("status").textContent).toContain("unavailable");
    expect(localStorage.getItem(questionHighlightKey("attempt"))).toBeNull();
  });
  it("keeps highlights working in memory when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    render(content()); await highlight();
    expect([...registry.values()].some(x => (x as { ranges: Range[] }).ranges.length === 1)).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Highlight added");
  });
  it("dismisses tools on Escape and ancestor scrolling", async () => {
    render(content()); choose(); await screen.findByRole("toolbar");
    fireEvent.keyDown(document, {key:"Escape"}); expect(screen.queryByRole("toolbar")).toBeNull();
    choose(); await screen.findByRole("toolbar"); fireEvent.scroll(document); expect(screen.queryByRole("toolbar")).toBeNull();
  });
});
