import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

// Unit and property-based tests (Vitest + fast-check). `npm test` runs them once.
// Tests live in tests/ and are type-checked by `npx tsc --noEmit` like the app.
export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next.js, so JSX in tests needs its own transform.
  esbuild: { jsx: "automatic" },
  resolve: {
    // Same "@/…" imports as the app (tsconfig paths: "@/*" → "./*").
    alias: { "@": root },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
