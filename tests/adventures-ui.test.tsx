import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Series, Detective, Debate, Rescue } from "@/components/adventures/guided-tools";
import { QuestionWorkshop, WorkshopPreview } from "@/components/adventures/question-workshop";
import { TeacherWorkshops } from "@/components/adventures/teacher-workshops";
import { workshopSchema } from "@/lib/adventures/rules";
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const reply = "I would like to explain my situation and ask for your help.";
describe("actual adventure interactions", () => {
  it("follows the chosen branch, persists a device reply, and separates owners", async () => {
    const { rerender } = render(<Series owner="alice" />); const input = screen.getByLabelText("Your response");
    await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: reply } }); fireEvent.click(screen.getByRole("button", { name: /Collect it at the airport/ }));
    expect(screen.getByText(/The bag should arrive at ten/)).toBeTruthy();
    rerender(<Series owner="bob" />); expect(screen.queryByText(/The bag should arrive at ten/)).toBeNull();
    rerender(<Series owner="alice" />); await waitFor(() => expect(screen.getByText(/The bag should arrive at ten/)).toBeTruthy());
  });
  it("opens all evidence before checking a conclusion", async () => {
    render(<Detective owner="alice" />); const button = screen.getByRole("button", { name: /Check my conclusion/ }); expect((button as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((screen.getByLabelText("Explain your evidence") as HTMLTextAreaElement).disabled).toBe(false));
    const details = document.querySelectorAll('details.adv-evidence');
    for (const detail of details) { (detail as HTMLDetailsElement).open = true; fireEvent(detail, new Event("toggle")); }
    fireEvent.click(screen.getByLabelText("It is in the cupboard by north reception")); fireEvent.change(screen.getByLabelText("Explain your evidence"), { target: { value: reply } });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button); expect(screen.getByText("Your conclusion matches the evidence")).toBeTruthy();
  });
  it("runs three debate rounds without fake AI scoring", async () => {
    render(<Debate owner="alice" />); await waitFor(() => expect((screen.getByLabelText("Your response") as HTMLTextAreaElement).disabled).toBe(false));
    for (let i = 0; i < 3; i++) { fireEvent.change(screen.getByLabelText("Your response"), { target: { value: reply } }); fireEvent.click(screen.getByRole("button", { name: i === 2 ? /Review my argument/ : /Next challenge/ })); }
    expect(screen.getByText("Now try the other side")).toBeTruthy(); expect(screen.getAllByRole("checkbox")).toHaveLength(3); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the rescue timer optional and offers a non-blocking restricted-word hint", async () => {
    render(<Rescue owner="alice" />); expect(screen.getByText("No timer pressure")).toBeTruthy(); await waitFor(() => expect((screen.getByLabelText("Your response") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Your response"), { target: { value: "My ticket is for today and I need your help." } }); expect(screen.getByText(/response includes a restricted word/)).toBeTruthy(); expect((screen.getByRole("button", { name: /Reveal the twist/ }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("never makes a class API request when sharing is disabled", async () => {
    render(<QuestionWorkshop owner="alice" sharing={false} />); await waitFor(() => expect((screen.getByLabelText("Workshop title") as HTMLInputElement).disabled).toBe(false)); expect(fetch).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: /Send for teacher review/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("requires a complete answer selection before revealing the key", () => {
    const payload = workshopSchema.parse({ title: "A clear title", passage: "The library opens at nine and stays open until five on every weekday. It has separate reading rooms for adults and children.", questions: [{ prompt: "When does the library open?", options: ["At seven", "At eight", "At nine", "At ten"], answer: 2, explanation: "The passage says it opens at nine." }], rightsConfirmed: true });
    render(<WorkshopPreview payload={payload} />); const check = screen.getByRole("button", { name: /Check against the answer key/ }); expect((check as HTMLButtonElement).disabled).toBe(true); fireEvent.click(screen.getByLabelText("At nine")); fireEvent.click(check); expect(screen.getByText("Matches the author's key")).toBeTruthy();
  });
  it("preserves typed work when device storage rejects a write", async () => {
    const setter = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); }); render(<Rescue owner="alice" />); await waitFor(() => expect((screen.getByLabelText("Your response") as HTMLTextAreaElement).disabled).toBe(false)); fireEvent.change(screen.getByLabelText("Your response"), { target: { value: reply } }); expect((screen.getByLabelText("Your response") as HTMLTextAreaElement).value).toBe(reply); expect(screen.getByText(/Device storage is full/)).toBeTruthy(); setter.mockRestore();
  });
  it("does not fetch teacher data before class sharing is enabled", () => { render(<TeacherWorkshops owner="teacher" enabled={false} />); expect(fetch).not.toHaveBeenCalled(); expect(screen.getByText("Class sharing is not enabled yet")).toBeTruthy(); });
});
