import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }), signOut: vi.fn() }));
import { Newspaper } from "lucide-react";
import {
  ADMIN_NAV,
  STUDENT_NAV,
  STUDENT_TABS,
  TEACHER_NAV,
  activeNavHref,
  navBadge,
} from "@/components/layout/portal-navigation";
import { STUDENT_COMMANDS, commandMatches } from "@/components/command-palette";

// Articles back in the student sidebar (.kiro/specs/new-tests-articles-listening-parts, Req 8–9).
const sidebar = STUDENT_NAV.flatMap((s) => s.items);
const skills = STUDENT_NAV.find((s) => s.label === "Skills")!.items;

describe("Articles in the student sidebar", () => {
  it("lists 7 Skills items with Articles second, a Newspaper icon and Language above Grammar (8.1)", () => {
    expect(skills.map((i) => i.name)).toEqual(["Reading", "Articles", "Listening", "Writing", "Speaking", "Grammar", "Vocabulary"]);
    const articles = skills[1];
    expect(articles.href).toBe("/article");
    expect(articles.icon).toBe(Newspaper);
    expect(skills.find((i) => i.subgroup)?.name).toBe("Grammar");
    expect(skills.find((i) => i.subgroup)?.subgroup).toBe("Language");
  });

  it("has 4/7/2/1/3 items, 17 in total, unique hrefs and short labels (8.4)", () => {
    expect(STUDENT_NAV.map((s) => s.label)).toEqual(["Home", "Skills", "Practice", "Coach", "Me"]);
    expect(STUDENT_NAV.map((s) => s.items.length)).toEqual([4, 7, 2, 1, 3]);
    expect(sidebar).toHaveLength(17);
    expect(new Set(sidebar.map((i) => i.href)).size).toBe(17);
    for (const item of sidebar) expect(item.name.split(" ").length).toBeLessThanOrEqual(2);
    // The other 16 items keep their order.
    expect(sidebar.filter((i) => i.href !== "/article").map((i) => i.href)).toEqual([
      "/dashboard", "/homework", "/calendar", "/messages",
      "/learning/reading", "/learning/listening", "/learning/writing", "/learning/speaking", "/grammar", "/flashcards",
      "/learning/mock-exam", "/studio", "/coach", "/progress", "/rankings", "/profile",
    ]);
  });

  it("never shows a New badge on Articles; only Speaking and AI Coach keep it (8.5)", () => {
    const early = new Date("2026-01-01T00:00:00Z");
    expect(navBadge(skills[1], early)).toBeUndefined();
    expect(navBadge(skills[1], new Date("2030-01-01T00:00:00Z"))).toBeUndefined();
    expect(sidebar.filter((i) => navBadge(i, early)).map((i) => i.name).sort()).toEqual(["AI Coach", "Speaking"]);
  });

  it("leaves the teacher and admin menus and the phone tabs unchanged (8.9)", () => {
    expect(STUDENT_TABS.map((t) => [t.name, t.href])).toEqual([
      ["Home", "/dashboard"], ["Skills", "/learning"], ["Practice", "/studio"], ["Coach", "/coach"], ["Me", "/progress"],
    ]);
    expect(TEACHER_NAV.flatMap((s) => s.items).some((i) => i.href === "/article")).toBe(false);
    expect(ADMIN_NAV.flatMap((s) => s.items).some((i) => i.href === "/article")).toBe(false);
    expect(ADMIN_NAV.map((s) => s.label)[0]).toBe("Umumiy koʻrinish");
  });

  // Feature: new-tests-articles-listening-parts, Property 41: Articles and Reading highlighting
  it("highlights only Articles under /article and only Reading under /learning/reading", () => {
    const slug = fc.stringMatching(/^[a-z0-9-]{1,24}$/);
    fc.assert(
      fc.property(fc.oneof(fc.constant(""), slug.map((s) => `/${s}`)), (tail) => {
        expect(activeNavHref(`/article${tail}`, sidebar)).toBe("/article");
        expect(activeNavHref(`/article${tail}`, STUDENT_TABS)).toBe("/learning");
        expect(activeNavHref(`/learning/reading${tail}`, sidebar)).toBe("/learning/reading");
      }),
      { numRuns: 200 },
    );
  });
});

describe("Articles in the command palette", () => {
  it("shows exactly one Articles command in Skills on the empty palette (9.1)", () => {
    const visible = STUDENT_COMMANDS.filter((c) => !c.searchOnly && c.label === "Articles");
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ group: "Skills", href: "/article", icon: Newspaper });
  });

  // Feature: new-tests-articles-listening-parts, Property 42: The palette finds Articles
  it("finds Articles for article/articles/news/lessons in any case and padding (9.2)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("articles", "article", "news", "lessons"),
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        fc.string({ unit: fc.constantFrom(" ", "\t"), maxLength: 3 }),
        fc.string({ unit: fc.constantFrom(" ", "\t"), maxLength: 3 }),
        (word, upper, lead, trail) => {
          const cased = [...word].map((ch, i) => (upper[i % upper.length] ? ch.toUpperCase() : ch)).join("");
          const q = `${lead}${cased}${trail}`.trim().toLowerCase();
          const hits = STUDENT_COMMANDS.filter((c) => commandMatches(c, q));
          expect(hits.some((c) => c.label === "Articles" && c.group === "Skills" && c.href === "/article")).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Articles link on the Reading library (9.6)", () => {
  it("renders the link before and outside the test list", () => {
    const src = readFileSync("app/learning/reading/page.tsx", "utf8");
    const link = src.indexOf('href="/article"');
    expect(link).toBeGreaterThan(0);
    expect(link).toBeLessThan(src.indexOf("<ExamLibrary"));
    expect(src).toContain("libraryCount()");
    expect(src).toContain("min-h-[44px]");
  });
});
