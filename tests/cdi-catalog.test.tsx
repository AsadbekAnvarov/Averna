/**
 * CDI catalog: the libraries list ONLY the CDI materials (by number) and the
 * admin's published AI-generated tests; the built-in Averna / legacy content is
 * archived — never listed, still resolvable by id. Plus the shared question
 * renderer's group image (maps / plans / diagrams).
 *
 * The database is an in-memory stand-in for GeneratedTest rows; React's and
 * Next's caches are pass-throughs, so every call reads the stand-in again.
 */
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LISTENING_SEED, READING_SEED } from "@/lib/ielts/content";
import { ARCHIVED_LISTENING, ARCHIVED_READING, ARCHIVED_WRITING } from "@/lib/ielts/content/archive";
import { CDI_LISTENING, CDI_READING, CDI_WRITING } from "@/lib/ielts/content/cdi";
import { cdiNumber, listedExams } from "@/lib/ielts/listing";
import type { ClientGroup, ExamSource } from "@/lib/ielts/types";
import { QuestionGroupView } from "@/components/exam/question-group";
import { task1ImageAlt } from "@/lib/writing-visual";

type Row = { id: string; module: string; published: boolean; title: string; data: unknown; createdAt: Date };

const state = vi.hoisted(() => ({ rows: [] as Row[], fail: false }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  // React 18.3 (outside Next's bundled canary) has no `cache`: a pass-through is enough here.
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, revalidateTag: () => {} }));
vi.mock("@/lib/db", () => {
  const guard = () => {
    if (state.fail) throw new Error("database down");
  };
  return {
    db: {
      generatedTest: {
        findMany: async ({ where }: { where: { module: string; published?: boolean } }) => {
          guard();
          return state.rows.filter((r) => r.module === where.module && (where.published == null || r.published === where.published));
        },
        findUnique: async ({ where }: { where: { id: string } }) => {
          guard();
          return state.rows.find((r) => r.id === where.id) ?? null;
        },
      },
    },
  };
});

const catalog = await import("@/lib/ielts/catalog");

const GENERATED_READING: Row = {
  id: "gen-reading-1",
  module: "READING",
  published: true,
  title: "Generated reading",
  data: { ...READING_SEED[0], id: "ignored" },
  createdAt: new Date("2025-01-01"),
};
const GENERATED_LISTENING: Row = {
  id: "gen-listening-1",
  module: "LISTENING",
  published: true,
  title: "Generated listening",
  data: { ...LISTENING_SEED[0], id: "ignored" },
  createdAt: new Date("2025-01-01"),
};
const GENERATED_TASK2: Row = {
  id: "gen-task2-1",
  module: "WRITING",
  published: true,
  title: "Generated essay",
  data: ARCHIVED_WRITING.task2[0],
  createdAt: new Date("2025-01-01"),
};

beforeEach(() => {
  state.rows = [GENERATED_READING, GENERATED_LISTENING, GENERATED_TASK2];
  state.fail = false;
});

const ARCHIVED_IDS = new Set([
  ...ARCHIVED_READING.map((t) => t.id),
  ...ARCHIVED_LISTENING.map((t) => t.id),
  ...ARCHIVED_WRITING.task1.map((p) => p.id),
  ...ARCHIVED_WRITING.task2.map((p) => p.id),
]);

describe("catalog listings", () => {
  it("Reading lists the CDI papers by number, then generated — nothing built-in", async () => {
    const list = await catalog.listReadingExams();
    expect(list.map((s) => s.id)).toEqual([...CDI_READING.map((t) => t.id), "gen-reading-1"]);
    const nums = list.slice(0, CDI_READING.length).map((s) => cdiNumber(s.id));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(list.every((s) => s.source === "cdi" || s.source === "generated")).toBe(true);
    expect(list.some((s) => ARCHIVED_IDS.has(s.id))).toBe(false);
  });

  it("Listening lists the CDI papers by number, then generated; CDI time comes from the recording", async () => {
    const list = await catalog.listListeningExams();
    expect(list.map((s) => s.id)).toEqual([...CDI_LISTENING.map((t) => t.id), "gen-listening-1"]);
    expect(list.some((s) => s.source === "averna" || s.source === "legacy")).toBe(false);
    for (const t of CDI_LISTENING) {
      const s = list.find((x) => x.id === t.id)!;
      expect(s.full).toBe(true);
      if (t.audio?.durationSec) expect(s.timeLimit).toBe(Math.round((t.audio.durationSec + 120) / 60));
    }
  });

  it("falls back to the CDI papers alone when the database is down", async () => {
    state.fail = true;
    expect((await catalog.listReadingExams()).map((s) => s.id)).toEqual(CDI_READING.map((t) => t.id));
    expect((await catalog.listListeningExams()).map((s) => s.id)).toEqual(CDI_LISTENING.map((t) => t.id));
  });

  it("Writing lists only the CDI prompts (then generated) for each task", async () => {
    const t1 = await catalog.listWritingTasks("task1");
    const t2 = await catalog.listWritingTasks("task2");
    expect(t1.map((p) => p.id)).toEqual(CDI_WRITING.task1.map((p) => p.id));
    expect(t1.every((p) => /^cdi-writing-\d{2}-t1$/.test(p.id) && !!p.imageUrl)).toBe(true);
    expect(t2.map((p) => p.id)).toEqual([...CDI_WRITING.task2.map((p) => p.id), "gen-task2-1"]);
    expect([...t1, ...t2].some((p) => ARCHIVED_IDS.has(p.id))).toBe(false);
  });
});

describe("archive (resolvable by id)", () => {
  it("built-in Reading / Listening papers still open by id", async () => {
    for (const t of ARCHIVED_READING) expect((await catalog.getReadingExam(t.id))?.id).toBe(t.id);
    for (const t of ARCHIVED_LISTENING) expect((await catalog.getListeningExam(t.id))?.id).toBe(t.id);
    expect((await catalog.getReadingExam(READING_SEED[0].id))?.source).toBe("averna");
    expect(ARCHIVED_READING.some((t) => t.source === "legacy")).toBe(true);
  });

  it("built-in Writing prompts still open by id; CDI and generated ones too", async () => {
    for (const task of ["task1", "task2"] as const) {
      for (const p of ARCHIVED_WRITING[task]) expect((await catalog.getWritingTask(task, p.id))?.id).toBe(p.id);
    }
    expect((await catalog.getWritingTask("task1", CDI_WRITING.task1[0].id))?.imageUrl).toBeTruthy();
    expect((await catalog.getWritingTask("task2", "gen-task2-1"))?.id).toBe("gen-task2-1");
  });

  it("lookups go CDI → archive → database", async () => {
    expect(await catalog.getReadingExam(CDI_READING[0].id)).toBe(CDI_READING[0]);
    expect(await catalog.getListeningExam(CDI_LISTENING[0].id)).toBe(CDI_LISTENING[0]);
    expect((await catalog.getReadingExam("gen-reading-1"))?.source).toBe("generated");
    expect(await catalog.getReadingExam("no-such-test")).toBeNull();
    expect(catalog.isArchivedContent(READING_SEED[0].id)).toBe(true);
    expect(catalog.isArchivedContent(CDI_READING[0].id)).toBe(false);
  });
});

// **Validates: CDI catalog decisions 1–2 (only CDI + generated are listed; CDI by number, then generated)**
describe("listedExams (property)", () => {
  const source = fc.constantFrom<ExamSource>("cdi", "generated", "averna", "legacy");
  const item = fc.record({
    id: fc.oneof(fc.integer({ min: 1, max: 99 }).map((n) => `cdi-reading-${String(n).padStart(2, "0")}`), fc.string({ minLength: 1, maxLength: 6 })),
    source,
  });

  it("keeps only CDI then generated items, CDI sorted by number, generated in order, ids unique", () => {
    fc.assert(
      fc.property(fc.array(item, { maxLength: 30 }), fc.array(item, { maxLength: 30 }), (cdi, generated) => {
        const out = listedExams(cdi, generated);
        expect(out.every((t) => t.source === "cdi" || t.source === "generated")).toBe(true);
        expect(new Set(out.map((t) => t.id)).size).toBe(out.length);
        const firstGenerated = out.findIndex((t) => t.source === "generated");
        const head = firstGenerated < 0 ? out : out.slice(0, firstGenerated);
        expect(head.every((t) => t.source === "cdi")).toBe(true);
        expect(out.slice(head.length).every((t) => t.source === "generated")).toBe(true);
        const nums = head.map((t) => cdiNumber(t.id)).map((n) => (Number.isFinite(n) ? n : Infinity));
        expect(nums).toEqual([...nums].sort((a, b) => a - b));
        // Generated keep their order; an id already taken (by CDI or an earlier row) is dropped.
        const taken = new Set(head.map((t) => t.id));
        const expected = generated
          .filter((t) => t.source === "generated")
          .map((t) => t.id)
          .filter((id) => (taken.has(id) ? false : (taken.add(id), true)));
        expect(out.slice(head.length).map((t) => t.id)).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });
});

describe("group image (question-group)", () => {
  const base: ClientGroup = {
    id: "g1",
    kind: "gap",
    instructions: "Label the map below.",
    wordLimit: 2,
    questions: [{ n: 11, text: "Car park [[11]]" }],
  } as ClientGroup;
  const props = { skill: "LISTENING" as const, answers: {}, onAnswer: () => {}, flagged: new Set<number>(), onToggleFlag: () => {} };

  it("renders the map above the questions with alt text, a caption and a full-size link", () => {
    const group = { ...base, image: { src: "/cdi/images/listening1-map.webp", alt: "Map of the town centre" } };
    const { container } = render(<QuestionGroupView group={group} {...props} />);
    const img = screen.getByRole("img", { name: "Map of the town centre" });
    expect(img.getAttribute("src")).toBe("/cdi/images/listening1-map.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("figcaption")?.textContent).toBe("Map of the town centre");
    const link = screen.getByRole("link", { name: /open full size/i });
    expect(link.getAttribute("href")).toBe("/cdi/images/listening1-map.webp");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    // Above the questions: the figure comes before the gap input.
    const figure = container.querySelector("figure")!;
    const input = container.querySelector("input")!;
    expect(figure.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no figure without an image", () => {
    const { container } = render(<QuestionGroupView group={base} {...props} />);
    expect(container.querySelector("figure")).toBeNull();
  });
});

describe("Task 1 image alt", () => {
  it("summarises the prompt's opening sentence", () => {
    const p = CDI_WRITING.task1[0];
    const alt = task1ImageAlt(p);
    expect(alt.startsWith("Task 1 visual: ")).toBe(true);
    expect(p.prompt.startsWith(alt.replace("Task 1 visual: ", "").replace(/…$/, ""))).toBe(true);
    expect(task1ImageAlt({ title: "Bar chart", prompt: "" })).toBe("Task 1 visual: Bar chart");
  });
});
