import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARTICLE_LESSONS, articlesForLevel, findArticle, articleReadingMinutes } from "@/lib/articles/catalog";
import { STUDENT_NAV } from "@/components/layout/portal-navigation";

describe("permanent article library", () => {
  it("imports exactly the two supplied level folders without daily rotation", () => {
    expect(ARTICLE_LESSONS).toHaveLength(11);
    expect(articlesForLevel("Pre-intermediate")).toHaveLength(10);
    expect(articlesForLevel("Intermediate")).toHaveLength(1);
    expect(articlesForLevel("Intermediate")[0].title).toBe("What Are They Like?");
    expect(articlesForLevel("unknown")).toHaveLength(0);
    expect(new Set(ARTICLE_LESSONS.map(a => a.slug)).size).toBe(11);
    expect(findArticle("missing-article")).toBeUndefined();
  });
  for (const article of ARTICLE_LESSONS) {
    it(`preserves content and source exercise keys: ${article.slug}`, () => {
      expect(findArticle(article.slug)).toBe(article);
      expect(article.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(article.body.length).toBeGreaterThan(1000);
      expect(articleReadingMinutes(article)).toBeGreaterThan(0);
      expect(article.vocabulary).toHaveLength(article.level === "Intermediate" ? 22 : 6);
      expect(article.exercises).toHaveLength(article.level === "Intermediate" ? 5 : 3);
      expect(article.discussion).toHaveLength(4);
      expect(article.blocks.some(block => block.parts.some(part => part.highlight))).toBe(true);
      for (const exercise of article.exercises) {
        expect(exercise.questions.length).toBeGreaterThan(0);
        for (const q of exercise.questions) {
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.options).toContain(q.answer);
          expect(new Set(q.options).size).toBe(q.options.length);
        }
      }
      expect(JSON.stringify(article)).not.toMatch(/<script|onclick\s*=|javascript:|<iframe|api[_-]?key/i);
    });
  }
  it("keeps existing authenticated URLs and handles missing articles", () => {
    for (const file of ["app/article/page.tsx", "app/article/[slug]/page.tsx"]) {
      expect(readFileSync(file, "utf8")).toContain('if (!session?.user) redirect("/auth/signin")');
    }
    expect(readFileSync("app/article/[slug]/page.tsx", "utf8")).toContain("if (!article) notFound()");
    // Articles is back in the student sidebar: Skills, right after Reading.
    const skills = STUDENT_NAV.find((s) => s.label === "Skills")!.items;
    const reading = skills.findIndex((i) => i.href === "/learning/reading");
    expect(skills[reading + 1]).toMatchObject({ name: "Articles", href: "/article" });
    for (const file of ["components/command-palette.tsx", "app/learning/page.tsx", "components/dashboard/daily-article.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain('"Daily Article"');
      expect(source).toContain("Articles");
    }
    for (const file of ["components/layout/app-sidebar.tsx", "components/layout/portal-navigation.ts"]) {
      expect(readFileSync(file, "utf8")).not.toContain('"Daily Article"');
    }
  });
});
