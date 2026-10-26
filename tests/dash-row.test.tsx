import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DASH_CARD, DASH_CENTER, DashRow, dashRowClass, type DashRowAt, type DashRowCols } from "@/components/ui/dash-row";

/** The .dash-row rules from app/globals.css, so jsdom applies the same contract as the browser. */
const ROW_CSS = readFileSync("app/globals.css", "utf8")
  .split("\n")
  .filter((line) => line.trimStart().startsWith(".dash-row"))
  .join("\n");

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = ROW_CSS;
  document.head.appendChild(style);
});
afterEach(cleanup);

const classesOf = (el: Element) => el.className.split(/\s+/);

describe("DashRow", () => {
  it("defaults to two columns from lg with the dashboard gaps", () => {
    const { container } = render(<DashRow><p>a</p><p>b</p></DashRow>);
    const row = container.firstElementChild!;
    for (const c of ["dash-row", "grid", "grid-cols-1", "gap-3", "md:gap-4", "lg:gap-5", "lg:grid-cols-2"]) expect(classesOf(row)).toContain(c);
    expect(classesOf(row)).not.toContain("md:grid-cols-2");
  });

  it("maps cols / at to full static class names", () => {
    const md = render(<DashRow at="md"><p>a</p></DashRow>).container.firstElementChild!;
    expect(classesOf(md)).toContain("md:grid-cols-2");
    const three = render(<DashRow cols={3}><p>a</p></DashRow>).container.lastElementChild!;
    expect(classesOf(three)).toContain("lg:grid-cols-3");
  });

  it("renders its children and passes attributes through", () => {
    render(
      <DashRow data-gamified="" aria-label="Rewards">
        <p>Daily Spin</p>
        <p>Mystery Box</p>
      </DashRow>
    );
    const row = screen.getByLabelText("Rewards");
    expect(row.hasAttribute("data-gamified")).toBe(true);
    expect(screen.getByText("Daily Spin").parentElement).toBe(row);
    expect(screen.getByText("Mystery Box").parentElement).toBe(row);
  });

  it("merges a caller className (twMerge) without losing the row contract", () => {
    const { container } = render(<DashRow className="gap-4 lg:gap-5 items-stretch [&>*]:h-full"><p>a</p></DashRow>);
    const cls = classesOf(container.firstElementChild!);
    expect(cls).toContain("dash-row");
    expect(cls).toContain("gap-4");
    expect(cls).not.toContain("gap-3");
    expect(cls).toContain("[&>*]:h-full");
  });

  it("stretches every cell, and a wrapper's single card fills the cell", () => {
    const { container } = render(
      <DashRow>
        <div className={DASH_CARD}>Mood</div>
        <div data-gamified>
          <div className={DASH_CARD}>Daily Spin</div>
        </div>
      </DashRow>
    );
    const row = container.firstElementChild as HTMLElement;
    expect(getComputedStyle(row).alignItems).toBe("stretch");
    const [card, wrapper] = Array.from(row.children) as HTMLElement[];
    expect(getComputedStyle(card).height).toBe("100%");
    expect(getComputedStyle(wrapper).height).toBe("100%");
    expect(getComputedStyle(wrapper.firstElementChild as HTMLElement).height).toBe("100%");
  });

  it("hides a cell whose widget rendered nothing", () => {
    const Nothing = () => null;
    const { container } = render(
      <DashRow>
        <div className={DASH_CARD}>Mood</div>
        <div data-gamified>
          <Nothing />
        </div>
      </DashRow>
    );
    const [card, empty] = Array.from(container.firstElementChild!.children) as HTMLElement[];
    expect(empty.matches(":empty")).toBe(true);
    expect(getComputedStyle(empty).display).toBe("none");
    expect(getComputedStyle(card).display).not.toBe("none");
  });

  it("exposes the shared card frame and centred body classes", () => {
    for (const c of ["dash-card", "rounded-2xl", "border", "h-full", "flex", "flex-col"]) expect(DASH_CARD.split(" ")).toContain(c);
    for (const c of ["flex-1", "flex", "flex-col", "justify-center"]) expect(DASH_CENTER.split(" ")).toContain(c);
  });

  it("property: any cols/at gives exactly one breakpoint column class and the base contract", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DashRowCols>(2, 3, 4, 5),
        fc.constantFrom<DashRowAt>("md", "lg"),
        (cols, at) => {
          const cls = dashRowClass(cols, at).split(" ");
          const colClasses = cls.filter((c) => /^(md|lg):grid-cols-\d$/.test(c));
          expect(colClasses).toEqual([`${at}:grid-cols-${cols}`]);
          for (const c of ["dash-row", "grid", "grid-cols-1", "gap-3", "md:gap-4", "lg:gap-5"]) expect(cls).toContain(c);
        }
      )
    );
  });
});
