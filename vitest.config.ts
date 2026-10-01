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
    // Same "@/…" imports as the app (tsconfig paths: "@/*" → "./*"). `server-only` resolves to
    // Next's empty server build (as on the server); the client-side guard is checked by `next build`.
    alias: { "@": root, "server-only": `${root}/node_modules/next/dist/compiled/server-only/empty.js` },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
