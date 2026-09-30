// Smoke test for the test setup itself (vitest.config.ts): jsdom environment,
// the "@/…" alias, JSX in .tsx tests and fast-check all work together.
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("test infrastructure", () => {
  it("runs in jsdom and renders JSX with Testing Library", () => {
    expect(typeof document).toBe("object");
    const { unmount } = render(<button type="button">Ready</button>);
    expect(screen.getByRole("button", { name: "Ready" })).toBeTruthy();
    unmount();
  });

  it("resolves the @ alias and runs fast-check properties", () => {
    fc.assert(
      fc.property(fc.constantFrom("p-2", "p-4", "px-3"), (padding) => {
        // tailwind-merge keeps only the last conflicting padding class.
        expect(cn("p-1", padding)).toBe(padding === "px-3" ? "p-1 px-3" : padding);
      }),
    );
  });
});
