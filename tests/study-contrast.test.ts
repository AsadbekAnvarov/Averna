import { describe, expect, it } from "vitest";
import palette from "@/lib/theme-tokens.json";
function luminance(hex: string) {
  const rgb = hex
    .replace("#", "")
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("study text contrast", () => {
  it("meets AA on the light study surface", () => {
    const ink = palette.tokens.find(([name]) => name === "study-ink")![2];
    expect(ratio(ink, "#e2e8f0")).toBeGreaterThanOrEqual(4.5);
  });
  it("meets AA on the dark study surface", () => {
    const ink = palette.tokens.find(([name]) => name === "study-ink")![1];
    expect(ratio(ink, "#10181b")).toBeGreaterThanOrEqual(4.5);
  });
});
