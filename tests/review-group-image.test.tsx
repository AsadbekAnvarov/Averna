// @vitest-environment jsdom
/**
 * The answer review (Reading + Listening result pages) shows a group's map /
 * plan like the exam does, so map-labelling answers can be checked there.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ExamGroup, GradeItem } from "@/lib/ielts/types";
import { ReviewGroup } from "@/components/exam/review-group";

afterEach(cleanup);

const mapGroup: ExamGroup = {
  kind: "matching",
  instructions: "Label the map below. Choose the correct letter, A–C.",
  image: { src: "/cdi/images/listening63-part2.webp", alt: "Map of the museum site showing locations A to C" },
  options: [
    { key: "A", text: "A" },
    { key: "B", text: "B" },
    { key: "C", text: "C" },
  ],
  questions: [
    { n: 18, text: "gallery", answer: ["C"] },
    { n: 19, text: "woodland", answer: ["A"] },
  ],
};

const items = new Map<number, GradeItem>([
  [18, { n: 18, kind: "matching", correct: true, given: "C", expected: "C", accepted: ["C"] }],
  [19, { n: 19, kind: "matching", correct: false, given: "B", expected: "A", accepted: ["A"] }],
]);

describe("ReviewGroup — group image", () => {
  it("shows the map in a figure with its alt text, an sr-only caption and an 'Open full size' link", () => {
    render(<ReviewGroup group={mapGroup} skill="LISTENING" items={items} />);
    const img = screen.getByRole("img", { name: mapGroup.image!.alt });
    expect(img.getAttribute("src")).toBe(mapGroup.image!.src);
    const figure = img.closest("figure")!;
    expect(figure).not.toBeNull();
    expect(figure.className).toContain("bg-white");
    const caption = figure.querySelector("figcaption")!;
    expect(caption.textContent).toBe(mapGroup.image!.alt);
    expect(caption.className).toContain("sr-only");
    const link = within(figure).getByRole("link", { name: /open full size/i });
    expect(link.getAttribute("href")).toBe(mapGroup.image!.src);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    // The review itself still lists both answers.
    expect(screen.getByText("gallery")).toBeTruthy();
    expect(screen.getByText("woodland")).toBeTruthy();
  });

  it("renders no figure for a group without an image", () => {
    const plain: ExamGroup = { ...mapGroup, image: undefined };
    const { container } = render(<ReviewGroup group={plain} skill="LISTENING" items={items} />);
    expect(container.querySelector("figure")).toBeNull();
    expect(screen.queryByRole("link", { name: /open full size/i })).toBeNull();
  });
});
