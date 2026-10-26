// Compact card defaults (p-4 → sm:p-5) must never override the padding a
// caller passes: twMerge only resolves conflicts within one variant, so the
// card parts drop the `sm:` defaults for sides the caller already pads.
import { render } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const SIDES: Record<string, string> = { p: "trbl", px: "rl", py: "tb", pt: "t", pr: "r", pb: "b", pl: "l" };

function classesOf(ui: React.ReactElement): string[] {
  const { container, unmount } = render(ui);
  const list = (container.firstElementChild as HTMLElement).className.split(/\s+/).filter(Boolean);
  unmount();
  return list;
}

/** Sides touched by padding tokens with the given variant prefix ("" = base). */
function sides(list: string[], variant: "" | "sm:"): Set<string> {
  const out = new Set<string>();
  for (const t of list) {
    if (variant === "" && t.includes(":")) continue;
    if (variant && !t.startsWith(variant)) continue;
    const m = /^(p[xytrbl]?)-/.exec(t.slice(variant.length));
    if (m) for (const s of SIDES[m[1]]) out.add(s);
  }
  return out;
}

describe("card part padding", () => {
  it("uses the compact defaults when the caller passes no padding", () => {
    expect(classesOf(<CardContent />).join(" ")).toBe("p-4 pt-0 sm:p-5 sm:pt-0");
    expect(classesOf(<CardHeader />).join(" ")).toBe("flex flex-col space-y-1 p-4 sm:p-5");
    expect(classesOf(<CardFooter />).join(" ")).toBe("flex items-center p-4 pt-0 sm:p-5 sm:pt-0");
    expect(classesOf(<CardContent className="space-y-3" />).join(" ")).toBe("p-4 pt-0 sm:p-5 sm:pt-0 space-y-3");
  });

  it("keeps a header-less card's own vertical padding on desktop", () => {
    const list = classesOf(<CardContent className="py-8" />);
    expect(list).toContain("py-8");
    expect(list).toContain("sm:px-5");
    expect(list).not.toContain("sm:p-5");
    expect(list).not.toContain("sm:pt-0");
  });

  it("keeps an all-sides caller padding at every width", () => {
    const list = classesOf(<CardContent className="p-6 relative" />);
    expect(list.filter((t) => t.startsWith("sm:p"))).toEqual([]);
    expect(list).toContain("p-6");
  });

  it("supports the codemodded header-less pattern pt-4 sm:pt-5", () => {
    const list = classesOf(<CardContent className="pt-4 sm:pt-5" />);
    expect(list).toEqual(expect.arrayContaining(["p-4", "pt-4", "sm:px-5", "sm:pb-5", "sm:pt-5"]));
    expect(list).not.toContain("pt-0");
    expect(list).not.toContain("sm:pt-0");
  });

  it("only adds the desktop title size when the caller sets none", () => {
    expect(classesOf(<CardTitle>Title</CardTitle>)).toEqual(expect.arrayContaining(["text-lg", "sm:text-xl"]));
    const small = classesOf(<CardTitle className="text-base text-white">Title</CardTitle>);
    expect(small).toContain("text-base");
    expect(small).not.toContain("sm:text-xl");
    expect(small).not.toContain("text-lg");
  });

  it("never lets a default sm: padding cover a side the caller pads at the base size", () => {
    const token = fc
      .tuple(fc.constantFrom("p", "px", "py", "pt", "pr", "pb", "pl"), fc.constantFrom("0", "2", "4", "6", "8"))
      .map(([u, n]) => `${u}-${n}`);
    fc.assert(
      fc.property(fc.array(token, { minLength: 1, maxLength: 3 }), fc.constantFrom("content", "header", "footer"), (tokens, part) => {
        const className = tokens.join(" ");
        const Part = part === "content" ? CardContent : part === "header" ? CardHeader : CardFooter;
        const list = classesOf(<Part className={className} />);
        const owned = sides(tokens, "");
        for (const side of sides(list, "sm:")) expect(owned.has(side), `${part} "${className}" → ${list.join(" ")}`).toBe(false);
      }),
      { numRuns: 150 },
    );
  });
});
