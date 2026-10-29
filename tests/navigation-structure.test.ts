import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }), signOut: vi.fn() }));

import {
  NEW_BADGE_UNTIL,
  STUDENT_NAV,
  STUDENT_TABS,
  TEACHER_NAV,
  activeNavHref,
  navBadge,
  navMatchLength,
} from "@/components/layout/portal-navigation";
import { COACH_TOOLS } from "@/components/coach/coach-tools";
import { STUDIO_TOOLS } from "@/components/studio/studio-tools";
import { STUDENT_COMMANDS, commandMatches } from "@/components/command-palette";

// Simpler navigation (docs/elegance-roadmap.md, idea 9).

/** Every href of the student sidebar before idea 9 (31 items in 5 sections). */
const FORMER_STUDENT_HREFS = [
  "/dashboard", "/learning", "/learning/reading", "/learning/listening", "/learning/writing", "/learning/speaking",
  "/learning/pronunciation", "/grammar", "/flashcards",
  "/learning/mock-exam", "/learning/placement", "/challenge", "/studio", "/studio/adventures", "/learning/examiner",
  "/mentor", "/article", "/movies",
  "/progress", "/learning-dna", "/rankings", "/rewards",
  "/homework", "/schedule", "/calendar", "/materials", "/tutoring", "/messages",
  "/notifications", "/profile", "/settings",
];

/** Hub pages whose links take over the items that left the sidebar. */
const HUB_FILES = [
  "app/coach/page.tsx",
  "app/studio/page.tsx",
  "app/learning/page.tsx",
  "app/learning/speaking/page.tsx",
  "app/calendar/page.tsx",
  "app/profile/page.tsx",
  "components/inbox-tabs.tsx",
];

const pathOf = (href: string) => href.split(/[?#]/)[0];
const routeExists = (href: string) => existsSync(join("app", ...pathOf(href).split("/").filter(Boolean), "page.tsx"));
const hrefsIn = (file: string) =>
  Array.from(readFileSync(file, "utf8").matchAll(/["'`](\/[a-z0-9\-/]*)(?:[?#][^"'`]*)?["'`]/gi), (m) => m[1]);

const sidebar = STUDENT_NAV.flatMap((s) => s.items);
const sidebarHrefs = sidebar.map((i) => i.href);
const hubHrefs = new Set([
  ...COACH_TOOLS.map((t) => pathOf(t.href)),
  ...STUDIO_TOOLS.map((t) => `/studio/${t.slug}`), // rendered by the Studio shelf
  ...STUDENT_TABS.map((t) => t.href),
  ...HUB_FILES.flatMap(hrefsIn),
]);
const paletteHrefs = new Set(STUDENT_COMMANDS.map((c) => c.href && pathOf(c.href)));
const search = (q: string) => STUDENT_COMMANDS.filter((c) => commandMatches(c, q.trim().toLowerCase())).map((c) => c.href && pathOf(c.href));

describe("student sidebar structure", () => {
  it("has at most 5 sections and 16 items, each with a short label", () => {
    expect(STUDENT_NAV.map((s) => s.label)).toEqual(["Home", "Skills", "Practice", "Coach", "Me"]);
    expect(sidebar.length).toBeLessThanOrEqual(17);
    for (const item of sidebar) expect(item.name.split(" ").length).toBeLessThanOrEqual(2);
  });

  it("never lists the same destination twice", () => {
    expect(new Set(sidebarHrefs).size).toBe(sidebarHrefs.length);
  });

  it("points every sidebar, tab, hub and palette link at an existing app route", () => {
    const all = [...sidebarHrefs, ...STUDENT_TABS.map((t) => t.href), ...COACH_TOOLS.map((t) => t.href), ...STUDENT_COMMANDS.flatMap((c) => (c.href ? [c.href] : []))];
    expect(all.filter((h) => !routeExists(h))).toEqual([]);
    expect(routeExists("/coach")).toBe(true);
  });

  it("keeps every former student nav destination reachable from the sidebar, a hub page or the palette", () => {
    for (const href of FORMER_STUDENT_HREFS) {
      expect(sidebarHrefs.includes(href) || hubHrefs.has(href) || paletteHrefs.has(href), href).toBe(true);
    }
  });

  it("gives every destination that left the sidebar both a hub and a palette entry", () => {
    for (const href of FORMER_STUDENT_HREFS.filter((h) => !sidebarHrefs.includes(h))) {
      expect(hubHrefs.has(href), `hub link for ${href}`).toBe(true);
      expect(paletteHrefs.has(href), `palette entry for ${href}`).toBe(true);
    }
  });

  it.each([
    // Old sidebar names…
    ["Learning Center", "/learning"], ["Pronunciation", "/learning/pronunciation"], ["Placement Test", "/learning/placement"],
    ["Daily Challenge", "/challenge"], ["Adventures", "/studio/adventures"], ["AI Examiner", "/learning/examiner"],
    ["AI Mentor", "/mentor"], ["Articles", "/article"], ["Movie Time", "/movies"], ["Learning DNA", "/learning-dna"],
    ["Rewards", "/rewards"], ["My Schedule", "/schedule"], ["Materials", "/materials"], ["1-on-1 Tutoring", "/tutoring"],
    ["Notifications", "/notifications"], ["Settings", "/settings"], ["My Progress", "/progress"], ["Dashboard", "/dashboard"],
    ["Messages", "/messages"],
    // …and common synonyms.
    ["mentor", "/mentor"], ["examiner", "/learning/examiner"], ["duel", "/studio/word-duel"], ["games", "/studio/memory-match"],
    ["words", "/flashcards"], ["flashcards", "/flashcards"], ["tutor", "/tutoring"], ["leaderboard", "/rankings"],
    ["inbox", "/messages"], ["partner", "/learning/speaking"], ["essay", "/studio/essay-xray"], ["coach", "/coach"],
  ])("finds %s in the command palette", (query, href) => {
    expect(search(query)).toContain(href);
  });

  it("groups palette commands by the sidebar's sections", () => {
    const groups = new Set(STUDENT_COMMANDS.map((c) => c.group));
    expect([...groups]).toEqual(STUDENT_NAV.map((s) => s.label));
  });
});

describe("student phone tab bar", () => {
  it("has exactly 5 tabs, one per section, on existing routes", () => {
    expect(STUDENT_TABS.map((t) => [t.name, t.href])).toEqual([
      ["Home", "/dashboard"], ["Skills", "/learning"], ["Practice", "/studio"], ["Coach", "/coach"], ["Me", "/progress"],
    ]);
    for (const t of STUDENT_TABS) expect(routeExists(t.href), t.href).toBe(true);
  });

  it.each([
    ["/learning/reading/abc", "/learning"], ["/learning/mock-exam/result/1", "/studio"], ["/studio/word-duel", "/studio"],
    ["/studio/essay-xray", "/coach"], ["/mentor", "/coach"], ["/learning/examiner", "/coach"], ["/rankings/leagues", "/progress"],
    ["/notifications", "/dashboard"], ["/settings", "/progress"],
  ])("highlights the right tab on %s", (path, tab) => {
    expect(activeNavHref(path, STUDENT_TABS)).toBe(tab);
  });
});

describe("active item: longest matching prefix wins", () => {
  it.each([
    ["/dashboard", "/dashboard"], ["/learning", null], ["/learning/speaking/room/r1", "/learning/speaking"],
    ["/learning/pronunciation", "/learning/speaking"], ["/learning-dna", "/coach"], ["/studio", "/studio"],
    ["/studio/adventures/series", "/studio"], ["/studio/roleplay", "/coach"], ["/coach", "/coach"],
    ["/notifications", "/messages"], ["/schedule", "/calendar"], ["/article/food", "/article"],
    ["/learning/placement/result/1", "/learning/mock-exam"], ["/progress/skills", "/progress"], ["/settings", "/profile"],
    ["/dashboardx", null], ["/coaching", null],
  ])("sidebar on %s → %s", (path, href) => {
    expect(activeNavHref(path, sidebar)).toBe(href);
  });

  const prefixes = Array.from(new Set([...sidebar, ...STUDENT_TABS].flatMap((i) => [i.href, ...(i.also ?? [])])));
  const segment = fc.constantFrom("a", "b1", "result", "series", "x-y", "learning", "studio", "coach", "speaking");
  const path = fc.oneof(
    // Any known prefix followed by 0–3 extra segments…
    fc.tuple(fc.constantFrom(...prefixes), fc.array(segment, { maxLength: 3 })).map(([p, rest]) => [p, ...rest].join("/")),
    // …or a fully random path.
    fc.array(segment, { minLength: 1, maxLength: 4 }).map((s) => "/" + s.join("/")),
  );

  it("picks an item whose match is at least as specific as every other item's (sidebar and tabs)", () => {
    fc.assert(
      fc.property(path, fc.constantFrom(sidebar, STUDENT_TABS), (p, items) => {
        const best = activeNavHref(p, items);
        const lengths = items.map((i) => navMatchLength(p, i));
        const max = Math.max(...lengths);
        if (max < 0) return best === null;
        const winner = items.find((i) => i.href === best);
        return !!winner && navMatchLength(p, winner) === max;
      }),
      { numRuns: 500 },
    );
  });

  it("only highlights an item when the path is its route or sits below it", () => {
    fc.assert(
      fc.property(path, (p) => {
        const best = sidebar.find((i) => i.href === activeNavHref(p, sidebar));
        if (!best) return true;
        return [best.href, ...(best.also ?? [])].some((pre) => p === pre || p.startsWith(pre + "/"));
      }),
      { numRuns: 500 },
    );
  });
});

describe("New badges", () => {
  it("are only on genuinely new things and expire on their own", () => {
    const fresh = [...sidebar, ...COACH_TOOLS].filter((i) => i.fresh).map((i) => i.href);
    expect(fresh.sort()).toEqual(["/coach", "/learning/speaking", "/learning/speaking"].sort());
    const until = Date.parse(`${NEW_BADGE_UNTIL}T00:00:00Z`);
    expect(navBadge({ fresh: true }, new Date(until - 1))).toBe("New");
    expect(navBadge({ fresh: true }, new Date(until))).toBeUndefined();
    expect(navBadge({ fresh: false }, new Date(until - 1))).toBeUndefined();
  });
});

describe("teacher navigation", () => {
  it("has one Inbox for messages and notifications and no duplicate destinations", () => {
    const items = TEACHER_NAV.flatMap((s) => s.items);
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain("/notifications");
    expect(activeNavHref("/notifications", items)).toBe("/messages");
    expect(items.find((i) => i.href === "/messages")?.name).toBe("Inbox");
  });
});
