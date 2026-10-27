/** Live speaking partner UI (docs/elegance-roadmap.md, idea 3): setup, "isn't available", call controls, summary. */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePartner } from "@/components/coach/live/live-partner";
import { LiveSetup } from "@/components/coach/live/live-setup";
import { CallControls } from "@/components/coach/live/call-controls";
import { LiveSummary } from "@/components/coach/live/live-summary";
import { liveStats, type LiveTurn } from "@/lib/realtime/stats";

const TOPICS = {
  casual: [{ id: "casual-travel", label: "Travel & Holidays" }],
  part1: [{ id: "p1-music", label: "Music" }, { id: "p1-sleep", label: "Sleep" }],
  part3: [{ id: "p3-x", label: "Money and saving" }],
};
const LIMITS = { studentSecondsPerDay: 600, maxCallSeconds: 240 };

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error test stub
  delete window.RTCPeerConnection;
});

const withWebRtc = () => {
  // @ts-expect-error test stub
  window.RTCPeerConnection = function RTCPeerConnection() {};
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: vi.fn() } });
};

describe("without an OpenAI key", () => {
  it("says the live partner isn't available and links to the AI Examiner — no Start button", () => {
    render(<LivePartner available={false} topics={TOPICS} limits={LIMITS} remainingSec={null} />);
    expect(screen.getByRole("heading", { name: "Live partner isn't available right now" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /AI Examiner/ });
    expect(link.getAttribute("href")).toBe("/learning/examiner");
    expect(link.className).toContain("min-h-[44px]");
    expect(screen.queryByRole("button", { name: /Start/ })).toBeNull();
  });
});

describe("setup screen", () => {
  it("offers the three modes, the mode's topics with Surprise me, today's minutes, a mic check and Start", () => {
    withWebRtc();
    const onStart = vi.fn();
    render(<LiveSetup topics={TOPICS} limits={LIMITS} remainingSec={480} onStart={onStart} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => (r.closest("label") as HTMLElement).textContent)).toEqual([
      expect.stringContaining("Casual chat"),
      expect.stringContaining("IELTS Part 1"),
      expect.stringContaining("Part 3 discussion"),
    ]);
    for (const r of radios) expect((r.closest("label") as HTMLElement).className).toContain("min-h-[44px]");
    expect(screen.getByText(/8 min of 10 min left today · this call up to 4 min/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test microphone" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Microphone level" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /IELTS Part 1/ }));
    const select = screen.getByRole("combobox", { name: "Topic" }) as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Surprise me", "Music", "Sleep"]);
    expect(select.className).toContain("min-h-[44px]");
    fireEvent.change(select, { target: { value: "p1-sleep" } });

    const startBtn = screen.getByRole("button", { name: /Start call/ });
    expect(startBtn.className).toContain("min-h-[48px]");
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledWith({ mode: "part1", topicId: "p1-sleep", topicLabel: "Sleep" });
  });

  it("disables Start when today's minutes are used up", () => {
    withWebRtc();
    render(<LiveSetup topics={TOPICS} limits={LIMITS} remainingSec={10} onStart={vi.fn()} />);
    expect(screen.getByText(/used today's live minutes/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Start call/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains when the browser can't make live calls", () => {
    render(<LiveSetup topics={TOPICS} limits={LIMITS} remainingSec={600} onStart={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toMatch(/can't make live calls/);
    expect((screen.getByRole("button", { name: /Start call/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("call controls", () => {
  it("are 44 px targets with clear labels and pressed states", () => {
    const onMute = vi.fn();
    const onEnd = vi.fn();
    const onCaptions = vi.fn();
    const { rerender } = render(<CallControls muted={false} onToggleMute={onMute} captionsOn onToggleCaptions={onCaptions} onEnd={onEnd} />);
    const mute = screen.getByRole("button", { name: "Mute microphone" });
    const captions = screen.getByRole("button", { name: /Show captions/ });
    const end = screen.getByRole("button", { name: "End call" });
    for (const b of [mute, captions, end]) {
      expect(b.className).toContain("min-h-[44px]");
      expect(b.className).toContain("min-w-[44px]");
    }
    expect(mute.getAttribute("aria-pressed")).toBe("false");
    expect(mute.getAttribute("aria-keyshortcuts")).toBe("Space");
    expect(end.getAttribute("aria-keyshortcuts")).toBe("Escape");
    expect(captions.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(mute);
    fireEvent.click(captions);
    fireEvent.click(end);
    expect([onMute, onCaptions, onEnd].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    rerender(<CallControls muted onToggleMute={onMute} captionsOn={false} onToggleCaptions={onCaptions} onEnd={onEnd} />);
    expect(screen.getByRole("button", { name: "Unmute microphone" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Show captions/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("How it went", () => {
  it("shows the stats, falls back to tips from the numbers, and is honest about missing clarity scores", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "AI tips aren't available right now." }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const turns: LiveTurn[] = [
      { id: "a", who: "ai", text: "What's the weather like where you live?" },
      { id: "m", who: "me", text: "Um the weather in Tashkent is very hot in summer and cold in winter", speechMs: 6000, logprobs: null },
    ];
    const stats = liveStats(turns, 95);
    render(
      <LiveSummary
        call={{ turns, stats, reason: "student", topicLabel: "The weather", server: { seconds: 95, xp: 0, xpNote: "Talk for at least 1 minute in a call to earn XP.", remainingSec: 400 } }}
        mode="part1"
        canCallAgain
        onNewCall={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "How it went" })).toBeTruthy();
    expect(screen.getByText("Talk time").nextElementSibling?.textContent).toBe("1:35");
    expect(screen.getByText("Your words").nextElementSibling?.textContent).toBe(String(stats.words));
    expect(screen.getByText(/not a phonetic test/)).toBeTruthy();
    expect(screen.getByText(/Clarity scores weren't available/)).toBeTruthy();
    expect(screen.getByText(/no audio is stored/i)).toBeTruthy();
    expect(screen.getByText(/at least 1 minute/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Based on your numbers.")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(3);
    // Sound tips only: "weather" (th) and "winter" (w) are in the practise list; the name isn't.
    expect(screen.getByRole("button", { name: "Hear “weather”" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Say “winter”" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /tashkent/i })).toBeNull();
    for (const b of screen.getAllByRole("button", { name: /Hear|Say/ })) expect(b.className).toContain("min-h-[44px]");
  });
});
