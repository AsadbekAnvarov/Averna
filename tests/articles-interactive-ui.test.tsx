import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/link needs the Next.js router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { InteractiveLesson, LESSON_LOAD_TIMEOUT_MS } from "@/components/articles/interactive-lesson";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { LESSON_NS } from "@/lib/articles/lesson-bridge";
import { ArticleLibrary } from "@/components/articles/article-library";
import { DailyArticle } from "@/components/dashboard/daily-article";

const lesson = { slug: "food-and-cooking", title: "Around the World in Seven Dinners", topic: "Food and cooking" };
const frame = () => screen.getByTitle(`${lesson.title} — interactive lesson`) as HTMLIFrameElement;
function fromFrame(data: unknown, source: unknown = frame().contentWindow, origin = "null") {
  act(() => {
    const event = new MessageEvent("message", { data, origin });
    Object.defineProperty(event, "source", { value: source });
    window.dispatchEvent(event);
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("InteractiveLesson", () => {
  it("frames the lesson sandboxed, without allow-same-origin", () => {
    render(<InteractiveLesson lesson={lesson} userId="u1" />);
    const iframe = frame();
    expect(iframe.getAttribute("src")).toBe("/api/articles/lesson/food-and-cooking");
    expect(iframe.getAttribute("sandbox")!.split(/\s+/).sort()).toEqual(["allow-modals", "allow-popups", "allow-popups-to-escape-sandbox", "allow-scripts"]);
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(screen.getByRole("link", { name: "Back to Articles" }).getAttribute("href")).toBe("/article?level=Intermediate");
    expect(screen.getByText("Intermediate · Food and cooking")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading lesson");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("answers hello with this student's saved values and the app theme, and stores valid writes", () => {
    localStorage.setItem("averna_theme", "light");
    localStorage.setItem("averna_lesson:u1:efvocab-v1-food", '{"xp":10}');
    localStorage.setItem("averna_lesson:u2:efvocab-v1-food", '{"xp":99}');
    render(<ThemeProvider><InteractiveLesson lesson={lesson} userId="u1" /></ThemeProvider>);
    const win = frame().contentWindow!;
    const post = vi.spyOn(win, "postMessage");

    fromFrame({ ns: LESSON_NS, type: "hello" });
    expect(post).toHaveBeenCalledWith({ ns: LESSON_NS, type: "state", items: { "efvocab-v1-food": '{"xp":10}' }, theme: "light" }, "*");

    fromFrame({ ns: LESSON_NS, type: "set", key: "efvocab-mute", value: "1" }, window); // not the frame
    fromFrame({ ns: LESSON_NS, type: "set", key: "efvocab-mute", value: "1" }, win, "http://localhost:3000"); // not opaque
    fromFrame({ ns: LESSON_NS, type: "set", key: "bad key", value: "1" });
    expect(localStorage.getItem("averna_lesson:u1:efvocab-mute")).toBeNull();

    fromFrame({ ns: LESSON_NS, type: "set", key: "efvocab-mute", value: "1" });
    fromFrame({ ns: LESSON_NS, type: "remove", key: "efvocab-v1-food" });
    expect(localStorage.getItem("averna_lesson:u1:efvocab-mute")).toBe("1");
    expect(localStorage.getItem("averna_lesson:u1:efvocab-v1-food")).toBeNull();
    expect(localStorage.getItem("averna_lesson:u2:efvocab-v1-food")).toBe('{"xp":99}');

    fromFrame({ ns: LESSON_NS, type: "ready" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sends app theme changes to the lesson", () => {
    localStorage.setItem("averna_theme", "light");
    function ThemeButton() {
      const { toggleMode } = useTheme();
      return <button type="button" onClick={toggleMode}>Toggle theme</button>;
    }
    render(<ThemeProvider><InteractiveLesson lesson={lesson} userId="u1" /><ThemeButton /></ThemeProvider>);
    const post = vi.spyOn(frame().contentWindow!, "postMessage");
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(post).toHaveBeenLastCalledWith({ ns: LESSON_NS, type: "theme", theme: "dark" }, "*");
  });

  it("offers Retry when the frame never answers, and Retry reloads the frame", () => {
    vi.useFakeTimers();
    render(<InteractiveLesson lesson={lesson} userId="u1" />);
    const first = frame();
    act(() => {
      vi.advanceTimersByTime(LESSON_LOAD_TIMEOUT_MS - 1);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("alert").textContent).toContain("This lesson could not be loaded. Check your connection and try again.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(frame()).not.toBe(first);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("Articles library with the interactive lessons", () => {
  it("lists 14 Intermediate lessons and the new counts", () => {
    render(<ArticleLibrary level="Intermediate" />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(14);
    expect(screen.getByText("14 articles · Available whenever you want to read")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Around the World in Seven Dinners/ }).getAttribute("href")).toBe("/article/food-and-cooking");
    expect(screen.getAllByText("Interactive lesson: games, quizzes and writing")).toHaveLength(13);
    const filters = screen.getByRole("navigation", { name: "Article level" });
    expect(filters.textContent).toContain("All articles 24");
    expect(filters.textContent).toContain("Pre-intermediate 10");
    expect(filters.textContent).toContain("Intermediate 14");
  });

  it("shows the totals on the dashboard Articles card", () => {
    render(<DailyArticle />);
    expect(screen.getByText("24 lessons with reading, vocabulary and practice.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Intermediate · 14" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pre-intermediate · 10" })).toBeTruthy();
  });
});
