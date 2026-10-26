/**
 * Smoke tests for the three Play-tab word games, rendered as students see them.
 * A fixed seed makes every board predictable through the pure logic in
 * lib/games/**, so each test can make one right and one wrong move and then
 * reach the win / results screen.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryMatch } from "@/components/games/memory-match";
import { WordRescue } from "@/components/games/word-rescue";
import { WordScramble } from "@/components/games/word-scramble";
import { MEMORY_FLIP_BACK_MS, MEMORY_PAIRS, dealMemory } from "@/lib/games/memory-match";
import { ALPHABET, RESCUE_ROUND, dealRescue, rescuePoints } from "@/lib/games/word-rescue";
import { SCRAMBLE_SECONDS, dealScramble } from "@/lib/games/word-scramble";

const SEED = 20250301;
const status = () => screen.getByRole("status").textContent ?? "";
const fetcher = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  // A reduced-motion user: confetti and flips stay still (and jsdom has no canvas).
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Memory Match", () => {
  it("announces a miss (flipping back after 900 ms) and a match, then shows the win screen", () => {
    vi.useFakeTimers();
    const deal = dealMemory(SEED);
    render(<MemoryMatch seed={SEED} />);
    expect(screen.getByText("Practice game · no points")).toBeTruthy();

    const cards = () => screen.getAllByRole("button", { name: /^Card \d+/ });
    expect(cards()).toHaveLength(MEMORY_PAIRS * 2);
    const at = (pairId: number, kind: "word" | "meaning") => deal.cards.findIndex((c) => c.pairId === pairId && c.kind === kind);
    const flip = (pairId: number, kind: "word" | "meaning") => fireEvent.click(cards()[at(pairId, kind)]);

    // Wrong: word 0 with meaning 1.
    flip(0, "word");
    expect(status()).toBe(`Word: ${deal.pairs[0].word}. Now find its pair.`);
    flip(1, "meaning");
    expect(status()).toBe("Not a pair. The cards will flip back.");
    expect(cards()[at(0, "word")].getAttribute("aria-label")).toMatch(/not a pair$/);
    act(() => {
      vi.advanceTimersByTime(MEMORY_FLIP_BACK_MS);
    });
    expect(cards()[at(0, "word")].getAttribute("aria-label")).toMatch(/face down$/);

    // Right: word 0 with meaning 0.
    flip(0, "word");
    flip(0, "meaning");
    expect(status()).toMatch(new RegExp(`^Match! ${deal.pairs[0].word} means`));
    expect(cards()[at(0, "word")].getAttribute("aria-label")).toMatch(/matched$/);

    for (let p = 1; p < MEMORY_PAIRS; p++) {
      flip(p, "word");
      flip(p, "meaning");
    }
    expect(screen.getByRole("heading", { name: "Board cleared!" })).toBeTruthy();
    expect(status()).toMatch(/^Board cleared in 7 moves/);
    const saved = JSON.parse(localStorage.getItem("averna_game_memory_v1")!) as { best: Record<string, unknown> };
    expect(Object.values(saved.best)).toEqual([{ moves: 7, ms: expect.any(Number) }]);
    expect(screen.getByRole("button", { name: /Play again/ })).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Word Rescue", () => {
  it("announces a right and a wrong letter, pops balloons only on misses and reaches the results", () => {
    const words = dealRescue(SEED);
    render(<WordRescue seed={SEED} />);
    expect(screen.getByText("Practice game · no points")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start rescue/ }));

    const answer = words[0].word.toLowerCase();
    const right = answer.match(/[a-z]/)![0];
    const wrong = ALPHABET.find((l) => !answer.includes(l))!;

    // Right letter via the on-screen keyboard.
    fireEvent.click(screen.getByRole("button", { name: `Letter ${right.toUpperCase()}` }));
    expect(status()).toMatch(new RegExp(`^Yes! ${right.toUpperCase()} is in the word`));
    expect(screen.getByRole("img", { name: "6 of 6 balloons left" })).toBeTruthy();

    // Wrong letter via the physical keyboard; repeating it is a no-op.
    fireEvent.keyDown(window, { key: wrong });
    expect(status()).toBe(`No ${wrong.toUpperCase()}. A balloon popped, 5 left.`);
    fireEvent.keyDown(window, { key: wrong.toUpperCase() });
    expect(status()).toBe(`You already tried ${wrong.toUpperCase()}.`);
    expect(screen.getByRole("img", { name: "5 of 6 balloons left" })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Letter ${wrong.toUpperCase()}, not in the word` })).toBeTruthy();

    // Finish word 1, then let words 2–5 pop.
    for (const l of new Set(answer.match(/[a-z]/g))) fireEvent.keyDown(window, { key: l });
    expect(status()).toBe(`Rescued! The word is ${words[0].word.toUpperCase()}. +${rescuePoints(5, 1)} points.`);
    for (let w = 1; w < RESCUE_ROUND; w++) {
      fireEvent.click(screen.getByRole("button", { name: /Next word/ }));
      const a = words[w].word.toLowerCase();
      for (const l of ALPHABET.filter((x) => !a.includes(x)).slice(0, 6)) fireEvent.keyDown(window, { key: l });
      expect(status()).toMatch(/The last balloon popped\. The word was/);
    }
    fireEvent.click(screen.getByRole("button", { name: /See results/ }));

    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(status()).toBe(`Round over: 1 of ${RESCUE_ROUND} words rescued, ${rescuePoints(5, 1)} points.`);
    expect(JSON.parse(localStorage.getItem("averna_game_rescue_v1")!)).toEqual({ bestScore: rescuePoints(5, 1), bestStreak: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Word Scramble", () => {
  it("announces a wrong build and a correct word, then the clock ends the sprint", () => {
    vi.useFakeTimers();
    const words = dealScramble(SEED);
    render(<WordScramble seed={SEED} />);
    expect(screen.getByText("Practice game · no points")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start sprint/ }));

    const answer = words[0].word.toUpperCase();
    // Wrong: the tray order is never the answer.
    const tray = within(screen.getByRole("group", { name: "Letter tiles" })).getAllByRole("button");
    expect(tray).toHaveLength(answer.length);
    tray.forEach((tile) => fireEvent.click(tile));
    expect(status()).toMatch(/^Not quite: [A-Z]+ isn't it\./);

    // Send everything back, then type the answer.
    for (let i = 0; i < answer.length; i++) fireEvent.keyDown(window, { key: "Backspace" });
    expect(within(screen.getByRole("group", { name: "Your answer" })).getAllByRole("button", { name: /empty$/ })).toHaveLength(answer.length);
    for (const ch of answer) fireEvent.keyDown(window, { key: ch.toLowerCase() });
    expect(status()).toBe(`Correct! ${answer} +16. Next word.`);

    // Skip the next word (no points), then let the clock run out.
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(status()).toBe(`Skipped. The word was ${words[1].word.toUpperCase()}.`);
    act(() => {
      vi.advanceTimersByTime(SCRAMBLE_SECONDS * 1000 + 400);
    });

    expect(screen.getByRole("heading", { name: "Time!" })).toBeTruthy();
    expect(status()).toBe("Time! 1 word solved, 16 points.");
    expect(JSON.parse(localStorage.getItem("averna_game_scramble_v1")!)).toEqual({ bestScore: 16, bestSolved: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
