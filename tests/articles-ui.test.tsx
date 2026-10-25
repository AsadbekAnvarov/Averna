import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleExercises } from "@/components/articles/article-exercises";
import { ARTICLE_LESSONS } from "@/lib/articles/catalog";

afterEach(cleanup);
const article = ARTICLE_LESSONS.find(a => a.level === "Intermediate")!;
const exercise = article.exercises[0];
function setup() { render(<ArticleExercises exercises={[exercise]} discussion={article.discussion} writingInstruction={article.writingInstruction} />); }
describe("article self-study interactions", () => {
  it("checks choices, counts unanswered and does not claim to grade corrections", () => {
    setup();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: exercise.questions[0].answer } });
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByRole("status").textContent).toBe(`1 / ${exercise.questions.length} correct. ${exercise.questions.length - 1} unanswered.`);
    expect(screen.getAllByLabelText(/If false, write/)).toHaveLength(exercise.questions.length);
    expect(screen.getByText(/not automatically graded/)).toBeTruthy();
  });
  it("shows the source key without replacing student choices, then fully resets", () => {
    setup();
    const selects = screen.getAllByRole("combobox");
    const incorrect = exercise.questions[0].options.find(o => o !== exercise.questions[0].answer)!;
    fireEvent.change(selects[0], { target: { value: incorrect } });
    const correction = screen.getAllByLabelText(/If false, write/)[0] as HTMLInputElement;
    fireEvent.change(correction, { target: { value: "My corrected sentence." } });
    fireEvent.click(screen.getByRole("button", { name: "Show answers" }));
    expect((selects[0] as HTMLSelectElement).value).toBe(incorrect);
    expect(screen.getByRole("status").textContent).toContain("Your choices have not been changed");
    expect(screen.getAllByText(`Answer: ${exercise.questions[0].answer}`).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((selects[0] as HTMLSelectElement).value).toBe("");
    expect(correction.value).toBe("");
    expect(screen.getByRole("status").textContent).toContain("Choose your answers");
  });
  it("supports every exercise type and isolates one exercise from another", () => {
    render(<ArticleExercises exercises={article.exercises} discussion={article.discussion} writingInstruction={article.writingInstruction} />);
    for (const e of article.exercises) {
      const section = screen.getByRole("heading", { name: e.title }).closest("section")!;
      const selects = within(section).getAllByRole("combobox");
      e.questions.forEach((q, i) => fireEvent.change(selects[i], { target: { value: q.answer } }));
      fireEvent.click(within(section).getByRole("button", { name: "Check answers" }));
      expect(within(section).getByRole("status").textContent).toBe(`${e.questions.length} / ${e.questions.length} correct. 0 unanswered.`);
    }
    const first = screen.getByRole("heading", { name: article.exercises[0].title }).closest("section")!;
    fireEvent.click(within(first).getByRole("button", { name: "Try again" }));
    expect(screen.getAllByRole("status")[1].textContent).toContain("5 / 5 correct");
    expect(screen.getByLabelText(article.writingInstruction)).toBeTruthy();
  });
});
