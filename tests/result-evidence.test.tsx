/** Result pages: "Show in text", "Hear it" and the mistakes-by-type card. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EvidenceActions, EvidenceScope, ResultRecording } from "@/components/exam/results/evidence";
import type { EvidenceDoc } from "@/components/exam/results/evidence-doc";
import { MistakesByTypeCard } from "@/components/exam/results/mistakes-by-type-card";
import type { EvidenceSpan } from "@/lib/review/evidence";

const PASSAGE: EvidenceDoc = {
  kind: "passage",
  title: "The Rise of the Vertical Farm",
  words: 40,
  paragraphs: [
    { label: "A", text: "Vertical farms stack crops indoors. Sceptics say the approach is costly." },
    { label: "B", text: "In 1909 Cassani drew a garden tower. It was never built." },
  ],
};
const SPAN: EvidenceSpan = { paragraphIndex: 1, start: 0, end: 36, source: "derived" };

const TRANSCRIPT: EvidenceDoc = {
  kind: "transcript",
  context: "A caller books a gym membership.",
  lines: [
    { index: 0, speaker: "Narrator", text: "Part 2.", narrator: true },
    { index: 1, speaker: "Owen", text: "I'm a paramedic, so I work for the ambulance service.", narrator: false },
  ],
};

function setDesktop(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: desktop ? (q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener() {}, removeEventListener() {} }) : undefined,
  });
}

afterEach(() => {
  cleanup();
  setDesktop(false);
  vi.restoreAllMocks();
});

const reading = () =>
  render(
    <EvidenceScope no={1} doc={PASSAGE} sideBySide>
      <p>Question 7</p>
      <EvidenceActions n={7} span={SPAN} />
    </EvidenceScope>
  );

describe("Reading result — Show in text", () => {
  it("phone: opens the sheet on the highlighted, focused sentence and announces it; Back returns to the question", async () => {
    reading();
    const button = screen.getByRole("button", { name: /Show in text/ });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog", { name: "Evidence for question 7" });
    const mark = dialog.querySelector("mark")!;
    expect(mark).toBeTruthy();
    expect(mark.textContent).toBe("In 1909 Cassani drew a garden tower.");
    expect(mark.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(mark);
    expect(screen.getByRole("status").textContent).toBe("Evidence for question 7 highlighted");

    fireEvent.click(within(dialog).getByRole("button", { name: "Back to question 7" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("mark")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("desktop: highlights in the side-by-side passage; a second tap (Hide) removes it", () => {
    setDesktop(true);
    reading();
    fireEvent.click(screen.getByRole("button", { name: /Show in text/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const mark = document.querySelector("mark")!;
    expect(mark.textContent).toBe("In 1909 Cassani drew a garden tower.");
    expect(document.activeElement).toBe(mark);
    expect(screen.getByRole("status").textContent).toBe("Evidence for question 7 highlighted");

    const hide = screen.getByRole("button", { name: /Hide/, pressed: true });
    fireEvent.click(hide);
    expect(document.querySelector("mark")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Evidence for question 7 hidden");
    expect(screen.getByRole("button", { name: /Show in text/, pressed: false })).toBeTruthy();
  });

  it("shows nothing for a question without evidence", () => {
    render(
      <EvidenceScope no={1} doc={PASSAGE}>
        <EvidenceActions n={3} span={null} />
      </EvidenceScope>
    );
    expect(screen.queryByRole("button", { name: /Show in text/ })).toBeNull();
  });
});

describe("Listening result — Hear it", () => {
  it("plays the part's recording from the evidence time minus 2 s", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    render(
      <EvidenceScope no={2} doc={TRANSCRIPT} media={<ResultRecording url="https://cdn.example/part-2.mp3" no={2} />}>
        <EvidenceActions n={12} span={{ paragraphIndex: 1, start: 0, end: 20, source: "quote" }} seconds={65.5} />
      </EvidenceScope>
    );
    const hear = await screen.findByRole("button", { name: /Hear it/ });
    await act(async () => {
      fireEvent.click(hear);
    });
    const audio = document.querySelector("audio")!;
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.contexts[0]).toBe(audio);
    expect(audio.currentTime).toBeCloseTo(63.5);
    expect(screen.getByRole("button", { name: /Pause/ })).toBeTruthy();
    // The transcript can still be opened at the same sentence.
    expect(screen.getByRole("button", { name: /Show in transcript/ })).toBeTruthy();
  });

  it("falls back to Show in transcript without a timed recording", () => {
    render(
      <EvidenceScope no={2} doc={TRANSCRIPT}>
        <EvidenceActions n={12} span={{ paragraphIndex: 1, start: 0, end: 20, source: "quote" }} seconds={null} />
      </EvidenceScope>
    );
    expect(screen.queryByRole("button", { name: /Hear it/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show in transcript/ }));
    expect(screen.getByRole("dialog").querySelector("mark")?.textContent).toBe("I'm a paramedic, so ");
  });
});

describe("Your mistakes by type", () => {
  it("lists each type with its count and links to one part of another test", () => {
    render(
      <MistakesByTypeCard
        skill="READING"
        lines={[
          { kind: "matching-headings", wrong: 3, total: 5, pick: { testId: "averna-reading-02", part: 0, testTitle: "Averna Academic Reading 2", partTitle: "Passage A" } },
          { kind: "tfng", wrong: 1, total: 6, pick: null },
        ]}
      />
    );
    const row = screen.getByTestId("mistakes-matching-headings");
    expect(row.textContent).toContain("Matching headings");
    expect(row.textContent).toContain("3 of 5 wrong");
    const link = within(row).getByRole("link", { name: /Practise matching headings/ });
    expect(link.getAttribute("href")).toBe("/learning/reading/averna-reading-02?part=0");
    expect(link.textContent).toContain("Averna Academic Reading 2 · Passage 1");
    const tfng = screen.getByTestId("mistakes-tfng");
    expect(tfng.textContent).toContain("1 of 6 wrong");
    expect(within(tfng).queryByRole("link")).toBeNull();
  });
});
