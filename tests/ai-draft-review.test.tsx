/** The one-tap approval panel's keyboard and approve → next + Undo (docs/elegance-roadmap.md, idea 10). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, refresh: nav.refresh, replace: vi.fn() }) }));

import { AiDraftReview } from "@/components/review/ai-draft-review";
import { DEFAULT_FILTERS } from "@/lib/review/filters";

const props = {
  testId: "test-12345",
  skill: "WRITING" as const,
  taskType: "task2" as const,
  studentName: "Aziza",
  aiBand: 6,
  draft: {
    band: 6,
    criteria: { taskAchievement: 6, coherenceCohesion: 6, lexicalResource: 6, grammarAccuracy: 6 },
    feedback: "Your position is clear.",
    nextSteps: ["Link your paragraphs"],
    source: "stored" as const,
  },
  generateOnOpen: false,
  aiAvailable: false,
  filters: { ...DEFAULT_FILTERS },
  nav: { prev: "test-prev01", next: "test-next01", position: 2, total: 3 },
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  nav.push.mockReset();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, next: "test-next01", undo: "tok.sig" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<AiDraftReview/>", () => {
  it("labels the draft and shows bands, feedback and next steps", () => {
    render(<AiDraftReview {...props} />);
    expect(screen.getByText("AI draft — check before approving")).toBeTruthy();
    expect(screen.getByText("Your position is clear.")).toBeTruthy();
    expect(screen.getByText("Link your paragraphs")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve band 6.0/ })).toBeTruthy();
  });

  it("J / K move through the queue; E edits; keys typed in a field do nothing", () => {
    render(<AiDraftReview {...props} />);
    fireEvent.keyDown(document.body, { key: "j" });
    expect(nav.push).toHaveBeenLastCalledWith(expect.stringContaining("/teacher/reviews/test-next01"));
    fireEvent.keyDown(document.body, { key: "k" });
    expect(nav.push).toHaveBeenLastCalledWith(expect.stringContaining("/teacher/reviews/test-prev01"));
    fireEvent.keyDown(document.body, { key: "e" });
    const box = screen.getByLabelText("Feedback for Aziza");
    fireEvent.keyDown(box, { key: "a" });
    fireEvent.keyDown(box, { key: "j" });
    expect(nav.push).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("A approves through the approve route, then opens the next attempt", async () => {
    render(<AiDraftReview {...props} />);
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/teacher/reviews/test-12345/approve");
    expect(JSON.parse(String(init.body))).toMatchObject({
      band: 6,
      criteria: props.draft.criteria,
      comment: "Your position is clear.\n\nNext steps:\n- Link your paragraphs",
    });
    expect(nav.push).toHaveBeenLastCalledWith(expect.stringContaining("/teacher/reviews/test-next01"));
  });
});
