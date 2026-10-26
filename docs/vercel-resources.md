# Vercel resources (Hobby plan)

## What counts against which limit

| Resource | What it is | Limit | Status |
|---|---|---|---|
| Functions Storage | The serverless function bundles of **every retained deployment** (code, `node_modules`, Prisma engine, traced files) | 10 GB | 9.22 GB used before this change |
| Deployment Storage | Static output of retained deployments: `public/`, `_next/static` (JS, CSS, fonts) | Usage page | Not the bottleneck |
| Blob | Files uploaded at runtime (listening audio, speaking recordings) | 1 GB | Watch it when adding media |

Functions Storage grew because of two multipliers:

1. **Bundles per deployment.** Vercel groups Next.js routes by their function config
   (`maxDuration`, `preferredRegion`, `memory`). The app had 19 routes with
   `maxDuration = 60`, 3 with `30` and the rest default: 3 Node bundles, each with its own
   Prisma query engine (~18.7 MB) and Next runtime.
2. **Deployments.** ~143 deployments in 30 days, most of them previews nobody opened.

## What this change does

- All per-route `maxDuration` exports are gone. `vercel.json` sets `"fluid": true`, so every
  function gets Fluid compute's default (and Hobby maximum) of 300 s. The old 60/30 s values
  only shortened that.
- Result: **one Node bundle per deployment instead of three** (~40 MB traced, see
  `npm run size:functions`).
- `vercel.json` → `ignoreCommand` runs `scripts/vercel-ignore-build.mjs`: production always
  builds, previews are **skipped** unless requested (below). A skipped preview stores nothing.
- CI (Build job) runs `node scripts/function-size.mjs --max-mb 60 --max-configs 1`, and
  `tests/function-config.test.ts` fails if a route exports `maxDuration`, `preferredRegion`
  or `memory` again.

## Dashboard settings (owner)

- **Settings → Security → Deployment Retention Policy:** Pre-Production 7 days, Errored 1 day,
  Canceled 1 day, Production 30 days. Old deployments (and their bundles) are then deleted
  automatically.
- **Settings → Functions:** keep **Fluid compute** on. The routes rely on its 300 s default.

## Getting a preview deployment

- Put `[preview]` (any case) anywhere in the commit message, e.g.
  `feat(x): new page [preview]`, or
- set the project env var `AVERNA_FORCE_PREVIEW=1` (Preview environment) while you need
  previews for every push.

Deploy hooks, `vercel` CLI deploys and manual redeploys (no commit message) always build.
Run `node scripts/vercel-ignore-build.mjs` with `VERCEL_ENV` / `VERCEL_GIT_COMMIT_MESSAGE`
set to check a case locally (exit 1 = build, 0 = skip).

## Rules for adding new resources

- **Audio, video, large images, PDFs** → Vercel Blob (watch the 1 GB) or an external static
  host such as the existing GitHub Pages audio repository. Never in the function bundle.
- **Small public images** → `public/`. That is Deployment Storage, not Functions Storage.
- **Large server-only text/JSON** → read it per item from disk at request time, and ship it
  with `outputFileTracingIncludes` scoped to the one route that serves it (like
  `content/articles` for `/api/articles/lesson/[slug]` in `next.config.mjs`). Don't import
  it statically from shared modules: that copies it into every bundle.
- **Never add per-route `maxDuration`, `preferredRegion` or `memory`.** Change durations
  project-wide in Vercel instead.
- Before pushing big content, run `npm run build && npm run size:functions` and compare
  the union size and the top contributors.

## Possible later step

Prisma's Rust-free client (Prisma ≥ 6.16, `engineType = "client"` with
`@prisma/adapter-pg`) would remove the ~18 MB query engine from the bundle. It is a major
upgrade from Prisma 5 and needs its own careful migration, so it is not part of this change.
