// @vitest-environment jsdom
/**
 * The Listening runner in recording mode (a CDI test: one real recording for
 * all four parts, `test.recording`). jsdom can't play media, so
 * HTMLMediaElement's play / pause / load are stubbed and the element's
 * currentTime / readyState / paused / error are driven by the test, which
 * dispatches the media events (playing, timeupdate, ended, error) itself.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientListeningTest } from "@/lib/ielts/types";
import { ListeningExamRunner } from "@/components/exam/listening-exam-runner";
import { RECORDING_LOAD_ERROR } from "@/components/exam/listening-recording-runner";
import { PlayFromHere, RecordingPlayerProvider } from "@/components/exam/results/recording-player";

vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };
  return {
    default: ({ href, children, ...rest }: LinkProps) => React.createElement("a", { href, ...rest }, children),
  };
});

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/learning/listening/x" }));

/** The fake media clock and element state. */
const media = { t: 0, paused: true, error: null as { code: number } | null };
const clock = { now: 1_700_000_000_000 };
let play: ReturnType<typeof vi.fn>;
let load: ReturnType<typeof vi.fn>;

beforeEach(() => {
  media.t = 0;
  media.paused = true;
  media.error = null;
  clock.now = 1_700_000_000_000;
  window.localStorage.clear();
  vi.spyOn(Date, "now").mockImplementation(() => clock.now);
  play = vi.fn(() => {
    media.paused = false;
    return Promise.resolve();
  });
  load = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play as unknown as () => Promise<void>);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
    media.paused = true;
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(load as unknown as () => void);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeTest(recording: ClientListeningTest["recording"]): ClientListeningTest {
  return {
    format: "exam-v2",
    skill: "LISTENING",
    id: "cdi-listening-99",
    title: "CDI Listening Test 99",
    description: "Test fixture",
    difficulty: "Medium",
    source: "cdi",
    recording,
    parts: [0, 1, 2, 3].map((i) => ({
      id: `p${i + 1}`,
      title: `Part ${i + 1}`,
      context: `Context of part ${i + 1}.`,
      speakers: [],
      script: [],
      groups: [
        {
          kind: "gap" as const,
          instructions: "Write ONE WORD ONLY for each answer.",
          wordLimit: 1,
          questions: [
            { n: i * 2 + 1, text: `First item [[${i * 2 + 1}]] here.` },
            { n: i * 2 + 2, text: `Second item [[${i * 2 + 2}]] here.` },
          ],
        },
      ],
    })),
  };
}

const URL_1 = "https://asadbekanvarov.github.io/averna-cdi-audio/audio/listening-99.mp3";
const WITH_STARTS = { url: URL_1, durationSec: 1725, partStarts: [50, 431, 847, 1190] };

function setup(opts: { mode: "practice" | "mock"; recording?: ClientListeningTest["recording"]; onSubmit?: () => Promise<void> }) {
  const utils = render(
    <ListeningExamRunner
      test={makeTest(opts.recording ?? WITH_STARTS)}
      mode={opts.mode}
      attemptId={`attempt-${Math.random().toString(36).slice(2)}`}
      onSubmit={opts.onSubmit}
      exitHref={opts.mode === "practice" ? "/learning/listening" : undefined}
    />
  );
  const el = utils.getByTestId("listening-recording") as HTMLAudioElement;
  Object.defineProperty(el, "currentTime", { configurable: true, get: () => media.t, set: (v: number) => (media.t = v) });
  Object.defineProperty(el, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(el, "paused", { configurable: true, get: () => media.paused });
  Object.defineProperty(el, "ended", { configurable: true, get: () => false });
  Object.defineProperty(el, "duration", { configurable: true, get: () => 1725 });
  Object.defineProperty(el, "error", { configurable: true, get: () => media.error });
  Object.defineProperty(el, "buffered", { configurable: true, get: () => ({ length: 0, start: () => 0, end: () => 0 }) });
  return { ...utils, el };
}

const heading = () => document.getElementById("listening-part-heading")?.textContent ?? "";

/** Start from the intro, and the element starts playing. */
function start(el: HTMLAudioElement) {
  fireEvent.click(screen.getByRole("button", { name: "Start the test" }));
  expect(play).toHaveBeenCalled();
  act(() => {
    el.dispatchEvent(new Event("playing"));
  });
}

/** The playhead reaches `sec` (a second of page time passes, so the player reports it). */
function at(el: HTMLAudioElement, sec: number) {
  act(() => {
    clock.now += 1000;
    media.t = sec;
    el.dispatchEvent(new Event("timeupdate"));
  });
}

describe("ListeningExamRunner — one real recording (CDI)", () => {
  it("plays a plain <audio preload=metadata> without crossOrigin", () => {
    const { el } = setup({ mode: "practice" });
    expect(el.getAttribute("src")).toBe(URL_1);
    expect(el.getAttribute("preload")).toBe("metadata");
    expect(el.hasAttribute("crossorigin")).toBe(false);
  });

  it("the questions follow the recording across partStarts", () => {
    const { el } = setup({ mode: "practice" });
    expect(heading()).toBe("Questions 1–2");
    start(el);
    at(el, 100);
    expect(heading()).toBe("Questions 1–2");
    at(el, 440);
    expect(heading()).toBe("Questions 3–4");
    // The student can look at another part meanwhile; the recording moves them on at the next part start.
    fireEvent.click(screen.getByRole("button", { name: /^Part 1 / }));
    expect(heading()).toBe("Questions 1–2");
    at(el, 600);
    expect(heading()).toBe("Questions 1–2");
    expect(screen.getByText("The recording is on Part 2 now.")).toBeTruthy();
    at(el, 900);
    expect(heading()).toBe("Questions 5–6");
    at(el, 1200);
    expect(heading()).toBe("Questions 7–8");
  });

  it("without partStarts the part tabs stay manual (no switch at the even split)", () => {
    const { el } = setup({ mode: "practice", recording: { url: URL_1, durationSec: 1600 } });
    start(el);
    at(el, 500);
    expect(heading()).toBe("Questions 1–2");
    expect(screen.getByRole("region", { name: "Recording" }).textContent).toMatch(/Recording/);
  });

  it("practice: pause, ±5 s and speed", () => {
    const { el } = setup({ mode: "practice" });
    start(el);
    at(el, 440);
    expect(screen.getByRole("button", { name: "Pause the recording" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Playback speed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forward 5 seconds" }));
    expect(media.t).toBeCloseTo(445, 3);
    fireEvent.click(screen.getByRole("button", { name: "Back 5 seconds" }));
    expect(media.t).toBeCloseTo(440, 3);
    fireEvent.click(screen.getByRole("radio", { name: "Speed 1.25 times" }));
    expect(el.playbackRate).toBe(1.25);
    fireEvent.click(screen.getByRole("button", { name: "Pause the recording" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Resume the recording" })).toBeTruthy();
  });

  it("mock: no pause, seek or speed — the recording plays once", () => {
    const { el } = setup({ mode: "mock", onSubmit: vi.fn(async () => {}) });
    expect(screen.queryByRole("button", { name: /Start again/ })).toBeNull();
    start(el);
    at(el, 440);
    expect(heading()).toBe("Questions 3–4");
    expect(screen.queryByRole("button", { name: /Pause the recording/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /seconds/ })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Playback speed" })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(el.playbackRate).toBe(1);
  });

  it("a recording that fails to load shows an alert with Retry, which loads it again", () => {
    const { el } = setup({ mode: "practice" });
    start(el);
    at(el, 120);
    act(() => {
      media.error = { code: 2 };
      el.dispatchEvent(new Event("error"));
    });
    const alert = screen.getAllByRole("alert").find((a) => a.textContent?.includes(RECORDING_LOAD_ERROR));
    expect(alert).toBeTruthy();
    expect(RECORDING_LOAD_ERROR).toBe("The recording could not be loaded. Check your connection and try again.");
    const calls = play.mock.calls.length;
    media.error = null;
    fireEvent.click(within(alert!).getByRole("button", { name: "Retry" }));
    expect(load).toHaveBeenCalled();
    expect(play.mock.calls.length).toBe(calls + 1);
    act(() => {
      el.dispatchEvent(new Event("playing"));
    });
    expect(screen.queryAllByRole("alert").some((a) => a.textContent?.includes(RECORDING_LOAD_ERROR))).toBe(false);
  });

  it("a load failure before Start shows the same alert; Retry reloads the file", () => {
    const { el } = setup({ mode: "mock", onSubmit: vi.fn(async () => {}) });
    act(() => {
      media.error = { code: 4 };
      el.dispatchEvent(new Event("error"));
    });
    const alert = screen.getAllByRole("alert").find((a) => a.textContent?.includes(RECORDING_LOAD_ERROR));
    expect(alert).toBeTruthy();
    fireEvent.click(within(alert!).getByRole("button", { name: "Retry" }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ended → checking time → the test submits itself when the review time runs out", async () => {
    const onSubmit = vi.fn(async () => {});
    const { el } = setup({ mode: "mock", onSubmit });
    fireEvent.change(screen.getByLabelText("Answer to question 1"), { target: { value: "station" } });
    start(el);
    at(el, 1700);
    act(() => {
      el.dispatchEvent(new Event("ended"));
    });
    expect(screen.getByText("The recording has finished")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      clock.now += 2 * 60_000 + 1000;
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [answers, meta] = onSubmit.mock.calls[0] as unknown as [Record<string, string>, { auto: boolean }];
    expect(answers["1"]).toBe("station");
    expect(meta.auto).toBe(true);
    await waitFor(() => expect(screen.getByText("Listening submitted")).toBeTruthy());
  });

  it("result page: Play from here starts the shared player 2 s before the answer", () => {
    render(
      <RecordingPlayerProvider url={URL_1}>
        <PlayFromHere question={5} seconds={130} />
        <PlayFromHere question={6} seconds={1} />
      </RecordingPlayerProvider>
    );
    const el = screen.getByTestId("result-recording") as HTMLAudioElement;
    Object.defineProperty(el, "currentTime", { configurable: true, get: () => media.t, set: (v: number) => (media.t = v) });
    Object.defineProperty(el, "readyState", { configurable: true, get: () => 4 });
    fireEvent.click(screen.getByRole("button", { name: "Play the recording from question 5" }));
    expect(media.t).toBe(128);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Test recording" }).textContent).toContain("from question 5");
    fireEvent.click(screen.getByRole("button", { name: "Play the recording from question 6" }));
    expect(media.t).toBe(0);
  });

  it("a test without a recording keeps the per-part runner", () => {
    const test = makeTest(undefined);
    render(<ListeningExamRunner test={test} mode="practice" attemptId="attempt-parts" exitHref="/learning/listening" />);
    expect(screen.queryByTestId("listening-recording")).toBeNull();
  });
});
