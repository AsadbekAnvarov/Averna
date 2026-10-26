/** The done screen's give-to-get peer feedback (components/speaking/peer-feedback.tsx), fetch mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FEEDBACK_POLL_MS, PeerFeedback } from "@/components/speaking/peer-feedback";
import { PeerCoach, COACH_CONSENT } from "@/components/speaking/peer-coach";

const dto = (over: Record<string, unknown> = {}) => ({
  fluency: 4,
  lexical: 2,
  grammar: 4,
  pronunciation: 5,
  strength: { id: "clear-voice", label: "Clear and easy to understand" },
  tip: { id: "vary-words", label: "Avoid repeating the same words" },
  note: "Nice story about Samarkand",
  createdAt: 1,
  ...over,
});

let state: { allowed: boolean; mine: unknown; received: unknown };
const posts: unknown[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    posts.push(body);
    if (String(url).startsWith("/api/speaking/coach"))
      return { ok: true, status: 200, json: async () => ({ bandEstimate: { low: 5.5, high: 6 }, strengths: ["Clear examples", "Good linking"], improvements: [{ point: "Vary verbs", original: "is good", rewrite: "is valuable" }], vocabularyUpgrades: [{ instead: "good", try: "beneficial" }] }) };
    state = { ...state, mine: dto(), received: (state.received as { partnerSubmitted?: boolean })?.partnerSubmitted ? dto({ lexical: 2 }) : null };
    return { ok: true, status: 200, json: async () => state };
  }
  return { ok: true, status: 200, json: async () => state };
});

beforeEach(() => {
  posts.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const rateAll = () => {
  for (const [title, n] of [["Fluency", 4], ["Vocabulary", 3], ["Grammar", 5], ["Pronunciation", 2]] as const) {
    const group = screen.getByRole("group", { name: new RegExp(`^${title}`) });
    fireEvent.click(within(group).getByRole("radio", { name: new RegExp(`^${n} of 5`) }));
  }
};

describe("PeerFeedback", () => {
  it("form: four 1–5 star radio groups with descriptors, chips, and Send only once all are rated", async () => {
    state = { allowed: true, mine: null, received: { locked: true, partnerSubmitted: false } };
    render(<PeerFeedback roomId="room-1" partnerName="Bek" own={null} />);
    const send = await screen.findByRole("button", { name: "Send feedback" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("radio")).toHaveLength(20);
    rateAll();
    expect(screen.getByText("Often hard to understand")).toBeTruthy(); // pronunciation 2's descriptor
    fireEvent.click(screen.getByRole("button", { name: "Linked ideas clearly" }));
    expect(screen.getByRole("button", { name: "Linked ideas clearly" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Slow down a little" }));
    fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "Great job" } });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ roomId: "room-1", fluency: 4, lexical: 3, grammar: 5, pronunciation: 2, strength: "linked-ideas", tip: "slow-down", note: "Great job" });
  });

  it("blocks contact details in the note before sending", async () => {
    state = { allowed: true, mine: null, received: { locked: true, partnerSubmitted: false } };
    render(<PeerFeedback roomId="room-1" partnerName="Bek" own={null} />);
    await screen.findByRole("button", { name: "Send feedback" });
    rateAll();
    fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "add me t.me/bek" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/links, e-mails or phone numbers/);
    expect(posts).toHaveLength(0);
  });

  it("keeps the partner's feedback locked until mine is sent, then reveals it with the next step", async () => {
    state = { allowed: true, mine: null, received: { locked: true, partnerSubmitted: true } };
    render(<PeerFeedback roomId="room-1" partnerName="Bek" own={null} />);
    expect(await screen.findByText("Bek has sent you feedback. Send yours to see it.")).toBeTruthy();
    expect(screen.queryByText(/Samarkand/)).toBeNull();
    expect(screen.queryByText("Your next step")).toBeNull();
    rateAll();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByText("Bek's feedback for you")).toBeTruthy();
    expect(screen.getByText("“Nice story about Samarkand”")).toBeTruthy();
    expect(screen.getByText("Your next step")).toBeTruthy();
    // Lowest rating received is vocabulary → Flashcards.
    expect(screen.getByRole("link", { name: /Open Flashcards/ }).getAttribute("href")).toBe("/flashcards");
  });

  it("after sending, polls every 5 s until the partner's feedback arrives", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
    state = { allowed: true, mine: dto(), received: null };
    render(<PeerFeedback roomId="room-1" partnerName="Bek" own={{ words: 200, wpm: 130, fillers: 20 }} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(screen.getByText("Waiting for Bek's feedback…")).toBeTruthy();
    const gets = () => fetchMock.mock.calls.filter(([, i]) => !i?.method).length;
    const before = gets();
    await act(async () => void (await vi.advanceTimersByTimeAsync(FEEDBACK_POLL_MS)));
    expect(gets()).toBe(before + 1);
    state = { ...state, received: dto({ fluency: 3, lexical: 4 }) };
    await act(async () => void (await vi.advanceTimersByTimeAsync(FEEDBACK_POLL_MS)));
    expect(screen.getByText("Bek's feedback for you")).toBeTruthy();
    // Own caption stats (many fillers) point the next step at fluency.
    expect(screen.getByText(/20 fillers in 200 words/)).toBeTruthy();
    const after = gets();
    await act(async () => void (await vi.advanceTimersByTimeAsync(FEEDBACK_POLL_MS * 3)));
    expect(gets()).toBe(after);
  });

  it("explains when feedback isn't open (the session never started)", async () => {
    state = { allowed: false, mine: null, received: { locked: true, partnerSubmitted: false } };
    render(<PeerFeedback roomId="room-1" partnerName="Bek" own={null} />);
    expect(await screen.findByText(/Feedback opens for sessions that got started/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  });
});

describe("PeerCoach", () => {
  it("asks for explicit consent before sending the own transcript", async () => {
    render(<PeerCoach roomId="room-1" transcript="my own words" stats={{ words: 30, wpm: 110, fillers: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Get AI feedback on your own speaking" }));
    expect(screen.getByText(COACH_CONSENT)).toBeTruthy();
    const go = screen.getByRole("button", { name: "Get feedback" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("I agree to send my captions transcript"));
    fireEvent.click(go);
    expect(await screen.findByText(/Estimated band 5.5–6.0/)).toBeTruthy();
    expect(screen.getByText(/not an official score/)).toBeTruthy();
    expect(posts[0]).toEqual({ roomId: "room-1", consent: true, transcript: "my own words", stats: { words: 30, wpm: 110, fillers: 1 } });
  });
});
