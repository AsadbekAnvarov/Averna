# Feedback → practice → evidence (stage 1)

This is stage 1 of the selected roadmap: feedback/revision (2), skill transfer (3), private portfolio (5), and saved-result explanation (14). Live classroom/calibration (6/7), admin queue/waitlist (11/12), and read-only finance scenarios (13) are separate follow-up changes.

## Learner and staff workflow

- Existing Writing and Speaking result pages offer **Open practice cycle**. Progress links to the private portfolio; the existing teacher Review Queue links to submitted practice.
- Starting freezes the original task/response and the available assessment into a dated baseline. Prefer a recorded human review; do not mix missing human criteria with AI values. An AI estimate is labelled as such. Missing scores remain unavailable, not fabricated from an unexplained total.
- Revise the original response, explain the change, save a private draft, then submit. Submission locks that response as evidence.
- An authorised human reviewer chooses an observation for each focus skill and quotes actual evidence from the response. This is formative feedback, not an IELTS re-band.
- After revision feedback, an authored short task checks application in a different context. Task 1 uses fictional tabular data; Task 2 and Speaking preparation use a small authored task bank selected for low topic overlap. This is not an unlimited AI task generator or a full IELTS exam.
- Both reviewed responses stay in the private portfolio. “Demonstrated” describes evidence in this response only, not permanent mastery or a guaranteed band increase.
- Speaking practice is **typed preparation from a saved transcript**, addressing grammar/lexical use only. It does not reassess pronunciation or delivery without new audio. Existing chart/audio access and retention rules are unchanged.
- Original grades, homework, balances, XP, streaks and AI jobs are not modified. No additional AI calls or external messages are made.

## Access and consistency

- Learners write only their own work; blacklisted learners cannot mutate practice. Staff see submitted entries, never private drafts.
- Current group teachers and administrators may review; self-review is denied even for staff with a Student profile. Unsupported roles are denied. There is no public or automatic parent-sharing link.
- Server identity supplies permissions; request payloads cannot choose another owner. Responses use private/no-store caching.
- Same-origin mutation checks, streamed JSON size limits and a fail-closed write rate limit protect the API.
- Mutations lock the original attempt and repeat authorization inside the same transaction/connection. Audit records and in-app notifications commit atomically with work.
- Optimistic draft versions prevent stale tab overwrites. Repeated identical submissions/reviews are no-ops, including PostgreSQL JSONB key reordering. Changed submitted evidence/reviews cannot be overwritten in v1.
- Draft saving is explicit. Unsaved changes trigger a browser unload warning; SPA navigation is not separately intercepted. A failed request keeps local text. A newer conflicting server draft blocks overwrite and asks the learner to copy local changes before reload.
- One revision and one transfer response per cycle in v1; more attempts/review corrections require a separate append-only design. Deleting the original attempt cascades deletion of its cycle.

## Safe release gate — default OFF

The code is active only when `LEARNING_CYCLE=on`. Otherwise entry links are hidden, new pages return not-found, and the API returns 404 before querying the new tables.

The migration is `prisma/migrations/20261009000100_learning_cycle/migration.sql`. It adds three tables without changing existing scores. It is deliberately **not appended to `prisma/sql/deploy.sql`**, so the legacy preview build does not silently apply it to a shared production database.

1. Keep the flag unset for normal preview/production. Create an isolated staging PostgreSQL database with the existing app schema. Verify its identity before any migration. Do not reuse a production `DATABASE_URL` in preview.
2. Follow the project's approved migration process. On the verified staging database only, apply the new SQL through an approved PostgreSQL client (`psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/20261009000100_learning_cycle/migration.sql`). Track its application in the deployment record. The DDL is rerunnable, but no schema-drift repair is promised. Do not invoke all historical migrations on an already-managed production database without reviewing its migration history.
3. Generate the Prisma client as normal, build and redeploy the staging app with `LEARNING_CYCLE=on`. The service uses parameterized SQL for new tables and works with the existing generated client too.
4. Complete staging acceptance below before proposing production rollout. For production, take/verify a backup, review the exact migration and retention policy, apply it in a controlled window, verify tables/permissions, then enable the flag and redeploy. Do not auto-merge as evidence that rollout is complete.
5. Roll back feature availability by removing the flag and redeploying. Preserve tables/evidence; do not drop learner data to roll back a UI release.

### Staging acceptance still required

- Run the complete learner revision → human review → new task → human review → portfolio flow for Writing Task 1, Task 2 and Speaking transcript preparation.
- Test no-transcript/short-response/unrated inputs, unassigned learners, blacklisted accounts, own profile as staff, another teacher/group and unsupported roles.
- Reassign a learner's group and verify the old teacher loses access, including the practice inbox.
- On real **multi-connection PostgreSQL**, race two draft saves, START calls, submit retries, review retries and original-result reviews; verify one committed entry/review, correct conflicts, frozen baseline and no duplicate notifications.
- Repeat mutations with a pool size of 1 to confirm all in-transaction authorization uses the transaction connection (no nested-pool deadlock).
- Simulate audit/notification failure and interrupted requests; ensure rollback or an idempotent retry. Inspect logs for absence of learner response text.
- Check mobile/desktop keyboard interaction, notification links, pagination, stale-tab preservation, feature-off routes and no accidental production migration.

## Local checks

```sh
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next lint
./node_modules/.bin/next build
# Validation needs a syntactically valid URL, but does not connect:
DATABASE_URL=postgresql://qa:qa@localhost:5432/qa ./node_modules/.bin/prisma validate
```

Use `next build`, **not** the legacy `vercel-build` script, for isolated local compilation.

`tests/learning-cycle-{rules,service,api,ui}.test.*` cover domain/state, permission/transaction boundaries, HTTP guards and form preservation. `scripts/verify-learning-cycle.cjs` additionally loads all migrations plus legacy SQL into an isolated PGlite instance and invokes the actual service and access helpers with synthetic fixtures. It does not read `DATABASE_URL` or connect to a live database. Supply a separately installed `@electric-sql/pglite` on `NODE_PATH`:

```sh
NODE_PATH=/path/to/isolated/node_modules node scripts/verify-learning-cycle.cjs
```

The SQL smoke covers private drafts, ownership/group access, version conflicts, atomic rollback, idempotency, notifications, portfolio flow, unchanged scores/XP/balances and delete cascades. PGlite does **not** replace real PostgreSQL concurrent-connection acceptance.
