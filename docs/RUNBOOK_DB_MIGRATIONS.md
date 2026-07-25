# Runbook — adopt Prisma migrations (S0b)

**Why.** The database had two sources of truth: `prisma/schema.prisma` and a
hand-written `CREATE TABLE` list inside `app/api/seed/route.ts`. The seed's DDL had
drifted (it never created `Commitment`, `ReviewItem`, `GeneratedTest`, and its
`students` table was missing many newer columns). `prisma db push` therefore saw a
mismatch and wanted a destructive reconciliation — which is why `--accept-data-loss`
was once added, and why accounts/XP were wiped.

**Done already (S0a, in this branch):** the seed is now **data-only**; the DDL is gone.
`prisma/schema.prisma` is the single source of truth.

**Remaining (S0b, needs DB access — must be run by you):** replace `db push` with a
versioned migration history so schema changes are reviewed and never destructive.

> ⚠️ Do **not** switch `vercel-build` to `prisma migrate deploy` until step 4 succeeds.
> `migrate deploy` with no `prisma/migrations/` folder applies nothing, so the schema
> would silently stop being updated.

---

## 0. Safety net first
In the Neon console, create a **branch** (instant copy) of the production database.
Do every experiment against the branch's connection string, never production.

```bash
export DB_PROD="postgres://…"     # production (read-only use here)
export DB_TEST="postgres://…"     # the Neon branch you just created
```

## 1. See the real drift (read-only, changes nothing)
```bash
npx prisma migrate diff \
  --from-url "$DB_PROD" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > drift.sql
```
Read `drift.sql`. Expect only additive statements (`CREATE TABLE`, `ADD COLUMN`,
`CREATE INDEX`). **If you see `DROP TABLE` or `DROP COLUMN` on a table that holds real
data, stop and send me `drift.sql`** — that's the destructive part we must convert by
hand into a safe, additive migration.

## 2. Create the baseline migration (describes the DB as it exists today)
```bash
mkdir -p prisma/migrations/00000000000000_baseline
npx prisma migrate diff \
  --from-empty \
  --to-url "$DB_PROD" \
  --script > prisma/migrations/00000000000000_baseline/migration.sql
```

## 3. Mark the baseline as already applied (does not touch data)
```bash
DATABASE_URL="$DB_TEST" npx prisma migrate resolve \
  --applied 00000000000000_baseline
```

## 4. Create + apply the catch-up migration on the TEST branch
```bash
DATABASE_URL="$DB_TEST" npx prisma migrate dev --name sync_schema_and_review_items
DATABASE_URL="$DB_TEST" npx prisma migrate status     # expect: up to date
```
Then point a local dev run at `$DB_TEST` and smoke-test login, a test submission, and
an SRS review.

## 5. Apply to production
```bash
DATABASE_URL="$DB_PROD" npx prisma migrate resolve --applied 00000000000000_baseline
DATABASE_URL="$DB_PROD" npx prisma migrate deploy
DATABASE_URL="$DB_PROD" npx prisma migrate status
```

## 6. Switch the deploy to migrations
In `package.json`:
```json
"vercel-build": "prisma generate && prisma migrate deploy && next build"
```
Commit `prisma/migrations/` (it must be in git). From now on, every schema change is
`prisma migrate dev --name <change>` locally, reviewed in the PR, applied automatically
and non-destructively on deploy.

---

## Rollback
- Steps 1–4 touch only the Neon branch → delete the branch, nothing lost.
- Step 6 → revert the `package.json` line; `db push` behaviour returns.
- Worst case → restore from the Neon branch / point-in-time restore.

## Invariants to keep
1. Only `prisma/schema.prisma` defines the schema. No raw DDL anywhere in the app.
2. Never reintroduce `--accept-data-loss` in a deploy command.
3. Any migration containing a `DROP` gets human review before it ships.
