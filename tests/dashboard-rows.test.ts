import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STUDIO_TOOLS } from "@/components/studio/studio-tools";

const source = (p: string) => readFileSync(p, "utf8");

/** Every class string in a file: "…" / '…' / `…` literals that look like Tailwind class lists. */
function classStrings(src: string): string[] {
  return Array.from(src.matchAll(/(["'`])((?:(?!\1)[^\n])*)\1/g), (m) => m[2]).filter((s) => /\b(grid|flex|gap-\d)/.test(s));
}

/** The side-by-side widget rows: one DashRow per row, so their frames line up. */
const ROW_FILES: Record<string, number> = {
  // Today: the Daily Session hero row (hero 2/3 + streak / path to target 1/3) lives in HomeTab.
  // Progress: the band forecast is a full-width hero, so that tab has two rows.
  "components/dashboard/tab-panels.tsx": 9,
  "components/progression/progression-home.tsx": 1,
  "app/teacher/dashboard/page.tsx": 3,
  "app/admin/dashboard/page.tsx": 4,
};

describe("even dashboard rows", () => {
  it.each(Object.entries(ROW_FILES))("%s has no top-aligned (items-start) grid row left", (file) => {
    const offenders = classStrings(source(file)).filter((s) => /\bgrid\b/.test(s) && /\bitems-start\b/.test(s));
    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(ROW_FILES))("%s lays its widget rows out with DashRow", (file, rows) => {
    const src = source(file);
    expect(src).toContain('from "@/components/ui/dash-row"');
    expect(src.match(/<DashRow\b/g)?.length ?? 0).toBe(rows);
  });

  it("keeps the staff dashboards' stretch contract on their rows", () => {
    for (const p of ["app/admin/dashboard/page.tsx", "app/teacher/dashboard/page.tsx"]) {
      expect(source(p)).toContain("gap-4 lg:gap-5 items-stretch [&>*]:h-full");
    }
  });
});

describe("Adventures leaves Today but stays in Practice Studio", () => {
  it("HomeTab no longer renders the Adventures entry", () => {
    const src = source("components/dashboard/tab-panels.tsx");
    const home = src.slice(src.indexOf("export async function HomeTab"), src.indexOf("export async function LearnTab"));
    expect(home.length).toBeGreaterThan(0);
    expect(home).not.toMatch(/Adventures/);
    expect(src).not.toContain("adventures-entry");
    expect(existsSync("components/dashboard/adventures-entry.tsx")).toBe(false);
  });

  it("/studio/adventures is still a Practice Studio tool (shown on the Learn tab's shelf)", () => {
    const tool = STUDIO_TOOLS.find((t) => `/studio/${t.slug}` === "/studio/adventures");
    expect(tool?.group).toBe("practice");
    expect(source("components/dashboard/tab-panels.tsx")).toContain('<StudioShelf group="practice" />');
  });
});
