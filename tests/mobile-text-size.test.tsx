/**
 * MobileTextSize — the phone-only "Aa" text size control in the ExamShell header
 * (task 5.1, design «B. Мобильный интерфейс» item 3). Rendered through ExamShell,
 * as students see it.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamShell, FONT_STEPS } from "@/components/exam/exam-shell";

// next/link needs the Next.js router at runtime; a plain anchor is enough here.
vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };
  return {
    default: function Link({ href, children, ...rest }: LinkProps) {
      return React.createElement("a", { href, ...rest }, children);
    },
  };
});

afterEach(cleanup);

function renderShell(fontScale: number) {
  const onFontScale = vi.fn<(v: number) => void>();
  const utils = render(
    <ExamShell
      title="Reading practice test"
      remainingMs={30 * 60_000}
      parts={[{ title: "Part 1", numbers: [1, 2, 3] }]}
      activePart={0}
      onPartChange={() => {}}
      answered={new Set<number>()}
      flagged={new Set<number>()}
      current={1}
      onJump={() => {}}
      fontScale={fontScale}
      onFontScale={onFontScale}
      onSubmit={() => {}}
      exitHref="/learning/reading"
    >
      <p>Questions</p>
    </ExamShell>
  );
  const header = utils.container.querySelector("header")!;
  const trigger = header.querySelector<HTMLButtonElement>('button[aria-label="Text size"]')!;
  const panel = () => {
    const id = trigger.getAttribute("aria-controls");
    return id ? document.getElementById(id) : null;
  };
  const button = (label: "Smaller text" | "Larger text") => panel()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return { ...utils, header, trigger, panel, button, onFontScale };
}

describe("MobileTextSize (phone text size in the exam header)", () => {
  it('"Aa" is a 44×44 phone-only button that opens and closes the panel', () => {
    const { trigger, panel } = renderShell(1);
    expect(trigger).not.toBeNull();
    expect(trigger.parentElement?.className).toContain("sm:hidden");
    expect(trigger.className.split(/\s+/)).toEqual(expect.arrayContaining(["h-11", "w-11"]));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    expect(panel()).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel()).not.toBeNull();
    expect(panel()!.querySelector('[aria-live="polite"]')?.textContent).toBe("100%");

    // A second tap on "Aa" closes it.
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel()).toBeNull();
  });

  it("the buttons step through FONT_STEPS and are disabled at the bounds", () => {
    FONT_STEPS.forEach((step, i) => {
      const { trigger, button, onFontScale, unmount } = renderShell(step);
      fireEvent.click(trigger);
      const smaller = button("Smaller text");
      const larger = button("Larger text");
      expect(smaller.disabled, `Smaller disabled at step ${i}`).toBe(i === 0);
      expect(larger.disabled, `Larger disabled at step ${i}`).toBe(i === FONT_STEPS.length - 1);
      expect(smaller.className.split(/\s+/)).toEqual(expect.arrayContaining(["h-11", "w-11"]));

      fireEvent.click(smaller);
      fireEvent.click(larger);
      const expected = [...(i > 0 ? [FONT_STEPS[i - 1]] : []), ...(i < FONT_STEPS.length - 1 ? [FONT_STEPS[i + 1]] : [])];
      expect(onFontScale.mock.calls.map(([v]) => v)).toEqual(expected);
      unmount();
    });
  });

  it("Escape and a tap outside close the panel", () => {
    const { trigger, panel, container } = renderShell(1.12);
    fireEvent.click(trigger);
    expect(panel()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(panel()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(panel()).not.toBeNull();
    fireEvent.pointerDown(container.querySelector('nav[aria-label="Question navigator"]')!);
    expect(panel()).toBeNull();
  });
});
