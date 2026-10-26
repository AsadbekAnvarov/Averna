/**
 * One-line value summaries of the collapsed Settings groups (lib/settings/summary.ts).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PREF_VALUES } from "@/lib/comfort/prefs";
import { displaySummary, effectsSummary, hintsSummary, readingSummary, soundSummary } from "@/lib/settings/summary";

describe("settings summaries", () => {
  it("read like the values they stand for", () => {
    expect(displaySummary("dark", "md")).toBe("Dark · Medium text");
    expect(displaySummary("light", "lg")).toBe("Light · Large text");
    expect(readingSummary({ font: "default", lineSpacing: "normal", contrast: "normal", ruler: "off" })).toBe("Standard font · Normal spacing");
    expect(readingSummary({ font: "readable", lineSpacing: "loose", contrast: "high", ruler: "on" })).toBe("Readable font · Loose spacing · High contrast · Ruler on");
    expect(hintsSummary("off", "always")).toBe("Hints off");
    expect(hintsSummary("uz", "level")).toBe("Uzbek hints · At my level");
    expect(hintsSummary("ru", "always")).toBe("Russian hints · Always");
    expect(effectsSummary({ focus: true, seasonal: false, ambiance: true })).toBe("Focus on · Seasonal off · Ambiance on");
    expect(soundSummary({ ui: false, ambient: false })).toBe("Sounds off");
    expect(soundSummary({ ui: true, uiPackLabel: "Glass", ambient: true, sceneLabel: "Soft Rain" })).toBe("Interface: Glass · Ambient: Soft Rain");
  });

  /** **Validates: collapsed summary text reflects values (compact settings, idea 8)** */
  it("name every non-default reading-comfort value, and only those, for any combination", () => {
    const prefs = fc.record({
      font: fc.constantFrom(...PREF_VALUES.font),
      lineSpacing: fc.constantFrom(...PREF_VALUES.lineSpacing),
      contrast: fc.constantFrom(...PREF_VALUES.contrast),
      ruler: fc.constantFrom(...PREF_VALUES.ruler),
    });
    fc.assert(
      fc.property(prefs, (p) => {
        const parts = readingSummary(p).split(" · ");
        expect(parts[0]).toBe(p.font === "readable" ? "Readable font" : "Standard font");
        expect(parts[1].toLowerCase()).toBe(`${p.lineSpacing} spacing`);
        expect(parts.includes("High contrast")).toBe(p.contrast === "high");
        expect(parts.includes("Ruler on")).toBe(p.ruler === "on");
        expect(parts).toHaveLength(2 + Number(p.contrast === "high") + Number(p.ruler === "on"));
      }),
      { numRuns: 200 }
    );
  });
});
