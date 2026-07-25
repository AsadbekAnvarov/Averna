# Runbook — adopt Prisma migrations (S0b)

**Why.** The database used to have two sources of truth: `prisma/schema.prisma` and a
hand-written `CREATE TABLE` list inside `app/api/seed/route.ts`. The seed's DDL had
drifted (it never created `Commitment`, `ReviewItem`, `GeneratedTest`, and its
`students` table was missing many newer columns). `prisma db push` therefore saw a
mismatch and wanted a destructive reconciliation — which is why `--accept-data-loss`
was once added, and why accounts and XP were wiped.

**Already done (in the repo):**
- **S0a** — the seed is data-only; `prisma/schema.prisma` is the single source of truth.
- The destructive `--accept-data-loss` flag is gone, so a deploy can now only fail
  safely, never delete data.

**Remaining (S0b — needs a machine with `node_modules` and the DB URL):** replace
`db push` with a versioned migration history, so every schema change is reviewed in a
PR and applied non-destructively.

> This half can't be done from the agent sandbox: the `prisma` CLI isn't installed
> there and it has no route to your database. The baseline is **generated**, never
> hand-written — hand-writing 37 tables would recreate exactly the drift problem we
> just eliminated.

---

## 0. Prerequisites

You need **Git** and **Node.js** installed, and a local copy of the repo.

- Git for Windows: https://git-scm.com/download/win (also gives you "Git Bash")
- Node.js LTS: https://nodejs.org

Check both, in a fresh terminal:

```
git --version
node --version
```

Then get the project (once):

```
cd %USERPROFILE%
git clone https://github.com/AsadbekAnvarov/Averna.git
cd Averna
npm install
```

> If you already have the folder, just `cd` into it and run `git pull && npm install`.
> **All commands below must be run from inside the `Averna` folder** — that's where
> `package.json` lives. Running them in `C:\Users\<you>` is the most common mistake.

## 1. Safety net + the DB URL

In the Neon console create a **branch** (an instant copy of production) and use its
connection string first. Setting an environment variable differs per shell:

| Shell | Command |
|---|---|
| **Windows cmd** | `set DATABASE_URL=postgres://...` |
| **Windows PowerShell** | `$env:DATABASE_URL="postgres://..."` |
| **Git Bash / macOS / Linux** | `export DATABASE_URL="postgres://..."` |

`export` does **not** exist in Windows cmd — that's why it errors there.

## 2. Run the baseline script

```
npm run db:baseline
```

It is cross-platform (plain Node, no bash needed) and refuses to run twice.

It does four things and prints what it found:

1. Generates `prisma/migrations/00000000000000_baseline/migration.sql` **from the
   schema** (no DB access needed) — this is the canonical "create everything" SQL.
2. Compares your **real** database to the schema and, if they differ, writes the
   difference to `prisma/migrations/00000000000001_sync_schema/migration.sql`.
   It counts `DROP` statements and warns loudly if any exist.
3. Marks the baseline as already applied (`migrate resolve`) — bookkeeping only, it
   creates and alters nothing.
4. Prints `migrate status`.

## 2. Review the drift before applying it

If step 1 created a `_sync_schema` migration, open it:

```
prisma/migrations/00000000000001_sync_schema/migration.sql
```

- Only `CREATE TABLE` / `ADD COLUMN` / `CREATE INDEX` → **safe**, continue.
- Any `DROP TABLE` / `DROP COLUMN` on a table that holds real data → **stop** and
  send me the file. I'll rewrite it as an additive migration (add the new shape,
  copy the data, drop later) so nothing is lost.

You can regenerate this diff at any time, read-only:

```bash
npm run db:drift
```

## 3. Apply and verify on the branch

```bash
npx prisma migrate deploy
npm run db:status        # expect: up to date
```

Then point a local dev server at the branch and smoke-test: sign in, submit a test,
do one flashcard review.

## 4. Repeat on production

```bash
export DATABASE_URL="postgres://…"   # production now
npm run db:baseline                  # skips regeneration, baselines prod
npx prisma migrate deploy
npm run db:status
```

## 5. Switch the deploy over

The migration-based build command is already in `package.json` as
`vercel-build:migrations`. Swap it in only **after** step 4 succeeded:

```json
"vercel-build": "prisma generate && prisma migrate deploy && next build"
```

Commit `prisma/migrations/` — it must be in git, or the deploy has nothing to apply.

From then on, a schema change is: `npm run db:migrate -- --name <change>` locally,
review the generated SQL in the PR, and it applies automatically and
non-destructively on deploy.

---

## Rollback
- Steps 0–3 touch only the Neon branch → delete the branch, nothing is lost.
- Step 5 → revert the `package.json` line; `db push` behaviour returns.
- Worst case → Neon point-in-time restore.

## Invariants
1. Only `prisma/schema.prisma` defines the schema. No raw DDL anywhere in the app.
2. Never reintroduce `--accept-data-loss` in a deploy command.
3. Any migration containing a `DROP` gets human review before it ships.
