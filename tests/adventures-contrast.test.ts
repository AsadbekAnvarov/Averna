import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const luminance = (hex: string) => { const values = hex.replace("#", "").match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
describe("Adventures readable themes", () => {
  it.each([{ mode: "dark", panel: "#0b151c", raised: "#13212b", ink: "#f3f7fa", muted: "#b3c2cc", accent: "#76e3ef", border: "#617a89", button: "#c7f4f8" }, { mode: "light", panel: "#ffffff", raised: "#f0f5f7", ink: "#152838", muted: "#455c6c", accent: "#006b7c", border: "#728998", button: "#ffffff" }])("keeps $mode text AA and interactive boundaries distinguishable", c => {
    for (const bg of [c.panel, c.raised]) { for (const fg of [c.ink, c.muted, c.accent]) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(c.border, bg)).toBeGreaterThanOrEqual(3); }
    expect(ratio(c.button, "#075466")).toBeGreaterThanOrEqual(4.5); expect(ratio("#fffFFF", "#6d1c2b")).toBeGreaterThanOrEqual(4.5);
  });
  it("overrides the legacy light-placeholder rule for new labelled inputs", () => { const css = readFileSync("components/adventures/adventures.css", "utf8"); expect(css).toContain("html.light .adventure-space input::placeholder,html.light .adventure-space textarea::placeholder{color:var(--adv-muted)"); });
});
