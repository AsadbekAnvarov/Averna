# Averna Learning Centre

IELTS preparation platform for Averna's students, teachers and administrators:
computer-delivered Reading, Listening, Writing and Speaking exams with AI marking,
homework and a teacher review queue, a placement test, progress tracking and
gamification, and a Telegram bot.

## Who uses what

| Role | Area | Language |
|---|---|---|
| Student | `/dashboard` — Today · Learn · Progress · Class · Play, plus `/learning`, `/studio` (Practice Studio), `/progress/*`, `/rankings/*` | English |
| Teacher | `/teacher/*` — students, attendance, gradebook, homework, review queue, mock results | English |
| Admin | `/admin/*` — groups, teachers, content, test generator, finance, Telegram, system | Uzbek (see `.kiro/steering/admin-language.md`) |

On phones every role gets a top bar (menu · search) and a five-item bottom tab bar;
on desktop, a left sidebar. `⌘K` / the search button opens the command palette.

## Stack

Next.js 14 (App Router, server components) · TypeScript · Tailwind CSS · Prisma +
PostgreSQL · NextAuth v5 (credentials) · OpenAI (marking, AI tutor, text-to-speech,
Whisper) · Vercel (hosting, Blob storage, Cron).

## Run it locally

Requirements: Node.js 20+, PostgreSQL.

```bash
npm install
cp .env.example .env        # set DATABASE_URL and NEXTAUTH_SECRET at least
npm run db:push             # create the tables (local database only)
npm run db:seed             # demo accounts and sample data
npm run dev                 # http://localhost:3000
```

Demo accounts (after seeding): `student1@averna.com` … `student5@averna.com` /
`student123`, `teacher@averna.com` / `teacher123`, `admin@averna.com` / `admin123`.

Every variable is explained in [`.env.example`](.env.example): `DATABASE_URL` and
`NEXTAUTH_SECRET` are required, the integrations (OpenAI, Vercel Blob, Telegram,
Cron) are optional and documented next to their variables.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` · `npx tsc --noEmit` | Lint and type-check (both also fail the build) |
| `npm run db:push` · `db:seed` · `db:studio` | Local schema, demo data, Prisma Studio |
| `npm run db:deploy` | Apply `prisma/sql/deploy.sql` (additive, idempotent) |
| `node scripts/generate-avatars.mjs` | Regenerate the preset avatars in `public/avatars/` |
| `node scripts/theme-tokens.mjs --write` | Rewrite the theme colour tokens in `app/globals.css` |
| `node e2e/screens.mjs` | Screenshot smoke test against a running app (`BASE_URL`) |

## Deploying (Vercel)

`npm run vercel-build` generates the Prisma client, applies
[`prisma/sql/deploy.sql`](prisma/sql/deploy.sql) and builds. That file only ever
adds tables, columns and indexes, so a deploy can never drop data; add new schema
changes to it in the same PR as `schema.prisma`. The move to versioned Prisma
migrations is described in [`docs/RUNBOOK_DB_MIGRATIONS.md`](docs/RUNBOOK_DB_MIGRATIONS.md).

`vercel.json` runs `/api/cron/daily` once a day (needs `CRON_SECRET`). Telegram
setup is described next to its variables in `.env.example`.

## Quality checks

- **CI** (`.github/workflows/ci.yml`) — TypeScript, ESLint and a production build
  on every push.
- **Screens** (`.github/workflows/screens.yml`) — seeds a fresh database, builds,
  signs in as each demo role and screenshots the key screens on a phone and on
  desktop in both themes. It fails on page errors, console errors, sideways
  overflow on phones and broken redirects. Runs when a commit message contains
  `[screens]` (or from the Actions tab); the screenshots are a downloadable artifact.

## Conventions

- **Theme.** Tailwind's `white`, grey scale, bright accent shades and `averna-*`
  brand colours resolve to CSS variables with a dark and a light value
  ([`lib/theme-tokens.json`](lib/theme-tokens.json)). Write classes for the dark
  design (`text-white`, `bg-white/5`, `text-averna-neon`); the light theme follows
  automatically and exam screens (`.exam-shell`) always stay dark.
- **Layout.** Pages start with `PageHeader`; dashboard sections use `SectionHeader`;
  hub pages (`/progress/*`, `/rankings/*`) share a layout with `HubNav`.
  Student-only pages use `getPageStudent()` from `lib/student-page.ts`.
- **Sound** is synthesised in the browser (`components/audio/sound-engine.ts`) and
  off by default; **avatars** are self-hosted SVGs (`lib/avatars.ts`).

## More documentation

- [`docs/PROGRESSION_ENGINE.md`](docs/PROGRESSION_ENGINE.md) — XP, levels, streaks and badges
- [`docs/RUNBOOK_DB_MIGRATIONS.md`](docs/RUNBOOK_DB_MIGRATIONS.md) — adopting Prisma migrations
- [`docs/BUSINESS_OS_PLAN.md`](docs/BUSINESS_OS_PLAN.md) — admin / business roadmap
- `prisma/schema.prisma` — the data model (commented)
