#!/usr/bin/env bash
#
# S0b — adopt Prisma migrations on an existing database, safely.
#
# Run this ONCE, from the repo root, on a machine that has node_modules installed.
# It is idempotent-ish: it refuses to run twice and never applies destructive SQL
# by itself. Nothing is written to the database except the migration bookkeeping
# table in step 3 (no schema change, no data change).
#
#   Step 1  generate the baseline from prisma/schema.prisma  (no DB access needed)
#   Step 2  generate the drift fix by comparing the real DB to the schema
#   Step 3  mark the baseline as already applied on the target DB
#   Step 4  review + apply the drift fix (you do this manually, after reading it)
#
# Usage:
#   export DATABASE_URL="postgres://…"     # the DB to baseline (use a Neon BRANCH first!)
#   bash scripts/db-baseline.sh
#
set -euo pipefail

BASELINE_DIR="prisma/migrations/00000000000000_baseline"
DRIFT_DIR="prisma/migrations/00000000000001_sync_schema"

command -v npx >/dev/null 2>&1 || { echo "❌ npx not found — install Node first."; exit 1; }
[ -f prisma/schema.prisma ] || { echo "❌ Run this from the repo root."; exit 1; }
[ -n "${DATABASE_URL:-}" ] || { echo "❌ Set DATABASE_URL first (use a Neon branch, not production)."; exit 1; }

if [ -d "$BASELINE_DIR" ]; then
  echo "⚠️  $BASELINE_DIR already exists — the baseline was already created."
  echo "    Nothing to do. To start over, delete prisma/migrations/ and re-run."
  exit 0
fi

echo "▶ Step 1/4 — generating the baseline from prisma/schema.prisma (no DB access)…"
mkdir -p "$BASELINE_DIR"
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$BASELINE_DIR/migration.sql"
echo "  ✓ $BASELINE_DIR/migration.sql ($(wc -l < "$BASELINE_DIR/migration.sql") lines)"

# Prisma needs to know the provider for the migrations folder.
if [ ! -f prisma/migrations/migration_lock.toml ]; then
  printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
  echo "  ✓ prisma/migrations/migration_lock.toml"
fi

echo "▶ Step 2/4 — checking how the real database differs from the schema…"
mkdir -p "$DRIFT_DIR"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$DRIFT_DIR/migration.sql"

DESTRUCTIVE=$(grep -icE '^\s*(DROP TABLE|DROP COLUMN|ALTER TABLE .* DROP)' "$DRIFT_DIR/migration.sql" || true)
LINES=$(grep -vcE '^\s*(--|$)' "$DRIFT_DIR/migration.sql" || true)

if [ "$LINES" -eq 0 ]; then
  echo "  ✓ No drift — the database already matches the schema."
  rm -rf "$DRIFT_DIR"
else
  echo "  ℹ $LINES statement(s) of drift written to $DRIFT_DIR/migration.sql"
  if [ "$DESTRUCTIVE" -gt 0 ]; then
    echo "  ⛔ WARNING: it contains $DESTRUCTIVE DROP statement(s)."
    echo "     DO NOT apply this blindly — send the file for review first."
  fi
fi

echo "▶ Step 3/4 — marking the baseline as already applied (bookkeeping only)…"
npx prisma migrate resolve --applied 00000000000000_baseline
echo "  ✓ baseline recorded; no tables were created or altered"

echo "▶ Step 4/4 — status:"
npx prisma migrate status || true

cat <<'NEXT'

────────────────────────────────────────────────────────────
Next steps (manual, on purpose):

 1. If a drift migration was created, READ it:
        prisma/migrations/00000000000001_sync_schema/migration.sql
    • only CREATE / ADD statements  → safe to apply
    • any DROP on a table with data → stop, get it reviewed

 2. Apply it:
        npx prisma migrate deploy
        npx prisma migrate status      # expect: up to date

 3. Smoke-test against this database (login, submit a test, an SRS review).

 4. Only once the above passed on a Neon BRANCH, repeat steps with
    DATABASE_URL pointing at production.

 5. Finally switch the deploy over (in package.json):
        "vercel-build": "prisma generate && prisma migrate deploy && next build"
    and commit prisma/migrations/ — it must be in git.
────────────────────────────────────────────────────────────
NEXT
