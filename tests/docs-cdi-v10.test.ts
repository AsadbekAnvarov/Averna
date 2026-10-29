import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("docs/cdi-volume-10-import.md", "utf8");

describe("Volume 10 docs and interface language", () => {
  it("documents the import, is linked from the CDI import doc and lists the 14 ids (22.4)", () => {
    expect(readFileSync("docs/cdi-materials-import.md", "utf8")).toContain("cdi-volume-10-import.md");
    for (const s of ["## Owner steps", "dry-run", "stage", "verify", "--apply --expected-host", "publish.cjs", "--unpublish", "Qismlar chegaralari"]) expect(doc).toContain(s);
    expect(doc).toContain("cdi-v10-reading-01");
    expect(doc).toContain("cdi-v10-listening-06");
    // No credentials or host names of the database.
    expect(doc).not.toMatch(/postgres(ql)?:\/\/|neon\.tech|password=/i);
    expect(readFileSync("docs/elegance-roadmap.md", "utf8")).not.toMatch(/to 16 items/);
  });

  it("writes the boundary block in Uzbek Latin (ʻ U+02BB, ʼ U+02BC) and the student copy in English (18.1, 18.2)", () => {
    const uz = readFileSync("lib/ielts/segments-messages.ts", "utf8") + readFileSync("components/admin/listening-boundaries.tsx", "utf8");
    // Uzbek strings: no ASCII apostrophe or typographic quote inside a word.
    const literals = Array.from(uz.matchAll(/"([^"\n]*[A-Za-zʻʼ][^"\n]*)"|`([^`\n]*)`/g)).map((m) => m[1] ?? m[2]);
    for (const s of literals.filter((x) => /\b(?:o|g)ʻ|ʼ|Chegara|Tasdiq|Yozuv/.test(x))) {
      expect(s, s).not.toMatch(/[A-Za-z]['`‘’][A-Za-z]/);
    }
    expect(uz).toContain("Tasdiqlash");
    expect(uz).toMatch(/oʻzgartirgan/);
    expect(uz).toMatch(/maʼlumotlari/);
    const en = readFileSync("lib/ielts/parts.ts", "utf8") + readFileSync("components/exam/segment-clip.ts", "utf8");
    expect(en).not.toMatch(/[\u0400-\u04FFʻʼ]/);
    // Design tokens only in the new components.
    for (const f of ["components/admin/listening-boundaries.tsx", "app/learning/reading/page.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|style=\{\{/);
    }
    expect(readFileSync("lib/ielts/audio/store.ts", "utf8")).toContain('"Toʻliq yozuv"');
  });
});
