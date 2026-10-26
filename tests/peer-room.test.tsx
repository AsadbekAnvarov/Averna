/**
 * components/speaking/peer-room.tsx on the session API (docs/peer-speaking.md, Phase B),
 * with fetch mocked and the WebRTC hook stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const voice = vi.hoisted(() => ({
  status: "connected" as const,
  micIssue: null,
  muted: false,
  toggleMute: () => undefined,
  localLevel: 0,
  remoteLevel: 0,
  localStream: null,
  audioBlocked: false,
  resumeAudio: () => undefined,
  attachAudio: () => undefined,
  hangup: () => undefined,
  retry: () => undefined,
  send: () => false,
  channelOpen: false,
}));
vi.mock("@/components/speaking/use-peer-voice", () => ({ usePeerVoice: () => voice }));

import { PeerRoom } from "@/components/speaking/peer-room";
import { buildPeerContent, type PeerContent } from "@/lib/speaking/peer-content";
import { advance, initialSessionState, phasePlan, type PeerSessionState, type Seat } from "@/lib/speaking/session";
import type { PeerFormat } from "@/lib/speaking/matching";

const NAMES = { A: "Aziza", B: "Bek" } as const;
const fresh = (format: PeerFormat) => initialSessionState(buildPeerContent(format, 6, () => 0.3), "A", { A: 6, B: 5.5 });
const started = (format: PeerFormat, at = Date.now()) => advance(advance(advance(fresh(format), "ready", "A", at), "ready", "B", at), "start", "A", at);
function finished(format: PeerFormat): PeerSessionState {
  let s = advance(advance(fresh(format), "ready", "A", 1), "ready", "B", 1);
  const plan = phasePlan(s);
  while (s.phase < plan.length - 1) {
    const p = plan[s.phase];
    s = advance(s, p.kind === "timed" ? "skip" : "start", p.kind === "timed" ? p.lead! : plan[s.phase + 1].lead!, Date.now());
  }
  return s;
}

function view(state: PeerSessionState, version: number, seat: Seat = "A", over: Record<string, unknown> = {}) {
  const other: Seat = seat === "A" ? "B" : "A";
  return {
    roomId: "room-1",
    status: currentDone(state) ? "ENDED" : "ACTIVE",
    format: state.format,
    topic: "t",
    state,
    version,
    serverNow: Date.now(),
    createdAt: Date.now() - 10 * 60_000,
    me: { seat, firstName: NAMES[seat], level: state.levels[seat] },
    partner: { seat: other, firstName: NAMES[other], level: state.levels[other] },
    xp: null,
    ...over,
  };
}
const currentDone = (s: PeerSessionState) => phasePlan(s)[s.phase]?.kind === "done";

type Reply = { status: number; body: unknown };
let server: { state: PeerSessionState; version: number; seat: Seat };
let onPost: (body: { action: string; version: number }) => Reply | Promise<Reply>;
const posts: { action: string; version: number }[] = [];
const res = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body });

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (String(url).startsWith("/api/speaking/feedback"))
    return res({ status: 200, body: { allowed: true, mine: null, received: { locked: true, partnerSubmitted: false } } });
  if (!init?.method || init.method === "GET") return res({ status: 200, body: view(server.state, server.version, server.seat) });
  const body = JSON.parse(String(init.body));
  posts.push(body);
  return res(await onPost(body));
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

const mount = (state: PeerSessionState, version: number, seat: Seat = "A", over: Record<string, unknown> = {}) => {
  server = { state, version, seat };
  return render(<PeerRoom initial={view(state, version, seat, over) as Parameters<typeof PeerRoom>[0]["initial"]} />);
};
const conv = (c: PeerContent) => (c.format === "conversation" ? c.rounds : (null as never));
const exam = (c: PeerContent) => (c.format === "exam" ? c.rounds : (null as never));

describe("PeerRoom", () => {
  it("lobby: ready, then the round's first lead starts once both are ready", async () => {
    const s0 = fresh("quick");
    onPost = ({ action }) => {
      server = { ...server, state: advance(server.state, action as "ready", "A", Date.now()), version: server.version + 1 };
      return { status: 200, body: { state: server.state, version: server.version, changed: true } };
    };
    mount(s0, 0);
    expect(screen.getByText("You're the examiner first, then you swap with Bek.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I'm ready" }));
    await screen.findByText("You: ready");
    expect(posts[0]).toEqual({ action: "ready", version: 0 });
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();

    // Bek gets ready; the next poll (here: the tab becoming visible) shows it.
    server = { ...server, state: advance(server.state, "ready", "B", Date.now()), version: 2 };
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    await waitFor(() => expect(posts[1]).toEqual({ action: "start", version: 2 }));
    expect(await screen.findByRole("heading", { name: "Part 2 · Preparation" })).toBeTruthy();
  });

  it("lobby: the partner waits for the lead to start", () => {
    const both = advance(advance(fresh("quick"), "ready", "A", 1), "ready", "B", 1);
    mount(both, 2, "B");
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.getByText("Waiting for Aziza to start…")).toBeTruthy();
  });

  it("exam: the examiner sees the script, the candidate only what a real candidate sees", () => {
    const s = started("exam");
    const q = exam(s.content)[0].part1[0].q;
    mount(s, 3, "A");
    expect(screen.getByText(q)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next question" })).toBeTruthy();
    expect(screen.queryByText("Listen to your examiner and answer.")).toBeNull();
    cleanup();

    mount(s, 3, "B");
    expect(screen.getByText("Listen to your examiner and answer.")).toBeTruthy();
    expect(screen.queryByText(q)).toBeNull();
    expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
    cleanup();

    const prep = advance(s, "skip", "A", Date.now());
    const cue = exam(prep.content)[0].cue.cue;
    mount(prep, 4, "B");
    expect(screen.getByText(cue)).toBeTruthy();
    expect(screen.getByLabelText("Your notes")).toBeTruthy();
    cleanup();
    mount(prep, 4, "A");
    expect(screen.getByText(cue)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start the talk now" })).toBeTruthy();
    expect(screen.queryByLabelText("Your notes")).toBeNull();
  });

  it("conversation: only the lead has Next card, which posts `next` with the version", async () => {
    const s = started("conversation");
    const cards = conv(s.content)[0];
    onPost = () => {
      server = { ...server, state: advance(server.state, "next", "A", Date.now()), version: 4 };
      return { status: 200, body: { state: server.state, version: 4, changed: true } };
    };
    mount(s, 3, "B");
    expect(screen.getByText(cards[0].text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    cleanup();

    mount(s, 3, "A");
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(await screen.findByText(cards[1].text)).toBeTruthy();
    expect(posts).toEqual([{ action: "next", version: 3 }]);
  });

  it("the lead's client sends exactly one `next` when the timer reaches 0", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2025-01-01T10:00:00Z"));
    const s = started("conversation", Date.now() - 118_500); // 1.5 s left on card 1
    const cards = conv(s.content)[0];
    let release: (r: Reply) => void = () => undefined;
    onPost = () => new Promise<Reply>((r) => (release = r));
    mount(s, 3, "A");
    expect(posts).toHaveLength(0);

    await act(async () => void (await vi.advanceTimersByTimeAsync(2500)));
    expect(posts).toEqual([{ action: "next", version: 3 }]);
    await act(async () => void (await vi.advanceTimersByTimeAsync(6000))); // polls keep returning the expired card
    expect(posts).toHaveLength(1);

    const next = advance(s, "next", "A", Date.now());
    server = { ...server, state: next, version: 4 };
    await act(async () => {
      release({ status: 200, body: { state: next, version: 4, changed: true } });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText(cards[1].text)).toBeTruthy();
    expect(posts).toHaveLength(1);
  });

  it("adopts the server's state and version from a 409", async () => {
    const s = started("conversation");
    const cards = conv(s.content)[0];
    const newer = advance(s, "next", "A", Date.now());
    onPost = () => ({ status: 409, body: { error: "The session moved on — refresh.", state: newer, version: 7 } });
    mount(s, 3, "A");
    server = { ...server, state: newer, version: 7 };
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(await screen.findByText(cards[1].text)).toBeTruthy();
    onPost = (b) => ({ status: 200, body: { state: advance(newer, "next", "A", Date.now()), version: b.version + 1, changed: true } });
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    await waitFor(() => expect(posts[1]).toEqual({ action: "next", version: 7 }));
  });

  it("End session asks first; Keep going cancels, confirming posts `end`", async () => {
    const s = started("debate");
    onPost = () => ({ status: 200, body: { state: advance(s, "end", "A", Date.now()), version: 4, changed: true } });
    mount(s, 3, "A");
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    const dialog = screen.getByRole("dialog", { name: "End the session?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep going" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(posts).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "End session" }));
    expect(await screen.findByRole("heading", { name: "Session ended by you" })).toBeTruthy();
    expect(posts).toEqual([{ action: "end", version: 3 }]);
  });

  it("done: a natural finish shows XP and the feedback form; an early end says who ended it", async () => {
    const done = finished("quick");
    mount(done, 9, "A", { xp: 25 });
    expect(screen.getByText("Session complete")).toBeTruthy();
    expect(screen.getByText("+25 XP")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Send feedback" })).toBeTruthy();
    expect(screen.getByText(/Duration: \d+ min/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "End session" })).toBeNull();
    expect(screen.getByRole("button", { name: "Report or block" })).toBeTruthy();
    // No captions were used: no AI coach offer.
    expect(screen.queryByRole("button", { name: /AI feedback/ })).toBeNull();
    cleanup();

    const early = advance(started("quick"), "end", "B", Date.now());
    mount(early, 4, "A");
    expect(screen.getByText("Session ended by Bek")).toBeTruthy();
    expect(screen.getByText("Finish both rounds to earn XP")).toBeTruthy();
    expect(screen.queryByText(/^\+\d+ XP$/)).toBeNull();
  });

  it("done: says why a natural finish earned no XP", () => {
    mount(finished("quick"), 9, "B", { xp: null, xpHold: "pair" });
    expect(screen.getByText("XP is limited to one session per partner per day")).toBeTruthy();
    cleanup();
    mount(finished("quick"), 9, "B", { xp: null, xpHold: "daily" });
    expect(screen.getByText("Daily peer-speaking XP limit reached")).toBeTruthy();
  });

  it("block from the room ends the session for this client too", async () => {
    const s = started("conversation");
    const ended = advance(s, "end", "A", Date.now());
    onPost = () => {
      server = { ...server, state: ended, version: 4 };
      return { status: 200, body: { ok: true, state: ended, version: 4 } };
    };
    mount(s, 3, "A");
    fireEvent.click(screen.getByRole("button", { name: "Report or block" }));
    const dialog = screen.getByRole("dialog", { name: "Report or block Bek" });
    expect(within(dialog).getByText(/never matched with you again/)).toBeTruthy();
    expect(within(dialog).getByText(/Two open reports pause/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Block Bek" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Yes, block Bek" }));
    expect(await screen.findByRole("heading", { name: "Session ended by you" })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/speaking/block" && JSON.parse(String(i?.body)).roomId === "room-1")).toBe(true);
  });
});
