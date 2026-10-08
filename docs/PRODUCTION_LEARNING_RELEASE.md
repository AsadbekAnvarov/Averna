# Production-learning release: staging first

This change set is not a claim that production has been migrated or audited.
No production database, mail provider, OpenAI account, or storage was used during development.

## Shipped in this change set

- Next.js 15 patch line / async request parameter migration; Auth.js beta patch.
- Original landing, palette and Inter typography retained; responsive session guide with 3/8/4-minute suggestions.
- Student-owned correction content, account-scoped local queue, explicit legacy import,
  server-side ownership checks, and matching rewrite practice linked from Writing feedback.
- Shared PostgreSQL fixed-window limits for AI and public account routes. Counters are HMAC-keyed.
  A global **request** ceiling is not a dollar ceiling; audio rendering can issue many model calls.
- Writing response validation, source labels, automatic estimate fallback, and local essay drafts.
- No cached authenticated HTML/RSC/API responses; a neutral offline shell replaces the cached dashboard.
- Confirmation and password reset via explicit Resend configuration. Token hashes only, expiry,
  one-use consumption, email binding, password policy, and invalidation of older password sessions.
- Generated baseline and additive feature migration; compatibility deploy SQL remains rerunnable.

## Preconditions

1. Make a verified backup and a separate test database/Neon branch. Test **restoration**, not just export.
2. Preserve a known-good deployment; roll application code back without dropping new tables.
3. Put new feature code behind a staging deployment first. Do not run `db:seed` on production.
4. The ingress proxy must remove attacker-supplied forwarding headers before supplying its own
   `x-vercel-forwarded-for` / `x-forwarded-for`. Otherwise the IP limiter is not trustworthy.
   Per-account and platform AI windows remain independently enforced.

## Database rollout

Three migration directories are provided:

- `20261008000100_baseline`: the original main schema before this change set.
- `20261008000200_production_learning`: only the new correction, token, and limit tables.
- `20261008000300_writing_retry`: the durable single-task Writing retry queue.

### Fresh disposable database

Set `DATABASE_URL` to the disposable DB and run `npm run db:generate` and
`npm run db:migrate` (or `npx prisma migrate deploy` for only the checked-in migrations).
Verify users, submissions, and corrections on that database.

### Existing database (first staging copy, then production)

Never execute the baseline CREATE statements against populated tables.

1. Run `npx prisma migrate status` and inspect the current `_prisma_migrations` history.
   If a different history already exists, stop and reconcile it; do not overwrite it.
2. Generate a read-only diff:
   `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`.
   On the old production schema it should propose **only** the four new tables, their indexes and FKs.
   Any unrelated drift, DROP, enum recreation, or existing-column change needs review before continuing.
   This diff is evidence of schema compatibility, not a backup.
3. Only after confirming that the old schema is the baseline, mark it applied:
   `npx prisma migrate resolve --applied 20261008000100_baseline`.
4. Apply the feature migration: `npx prisma migrate deploy`.
5. Verify `npx prisma migrate status` and rerun the read-only diff; it should be empty.
6. Test account creation/login, a Writing submission, a correction on two devices, and a teacher review.
7. Repeat on production during a planned release window with the restored backup path available.
8. Set Vercel's build command to `npm run vercel-build:migrations` once migration history is adopted.

If the compatibility additive deploy SQL already created the first three new tables, verify an empty diff
first, then mark `20261008000200_production_learning` applied instead of executing it twice. Check the Writing queue separately before marking
`20261008000300_writing_retry` applied; never mark a migration whose schema has not been verified.
Do not use `--accept-data-loss`, `migrate reset`, or DROP statements on a real database.

## Mail rollout

Set `RESEND_API_KEY`, `ACCOUNT_MAIL_FROM` (verified sender), and `ACCOUNT_APP_URL` (canonical HTTPS origin)
in hosting settings. Start with `REQUIRE_EMAIL_VERIFICATION=false`. Send confirmation/reset mail
from staging, exercise expiry, repeat-click handling, and old-session invalidation, then explicitly enable
verification. Existing accounts retain their existing verification values; no bulk account mutation is performed.
A historical `emailVerified` value is not newly proven by this change set.

Password reset stays disabled with an actionable error when mail is not configured.
Never paste keys into source control or commit local `.env` files. Tokens are stripped from the confirmation
page's visible URL after loading; POST consumes them. Opening/scanning an email link alone does not consume it.

## Acceptance checks before release

- Run `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit`.
- Inspect each remaining advisory for runtime applicability; a patch update does not prove full security.
- Two different accounts in the same browser do not see each other's correction cache.
- The old unscoped bank is imported only after the student explicitly confirms ownership.
- Offline additions remain pending until the API acknowledges them; repeated sync creates no duplicates.
- Switching accounts/offline never returns another person's cached dashboard or teacher pages.
- A failed AI request preserves a submitted Writing result with an explicit heuristic label.
- Typed essays restore after reload in the **same account and task on that device**; they are not cloud drafts.
- Only the owner can seed a correction from a saved Writing attempt.
- No grade or XP is awarded for a timer, checkbox, or matching rewrite alone.
- The teacher's existing review remains separate from automatic estimates.
- Check real iPhone/Safari audio and recording, slow internet, and refresh/retry during an exam.

## Not included / next milestones

- Hosted production integration testing and actual deployment (requires authorised hosting/DB access).
- Durable queues for Speaking/full Writing exams/mock aggregates, and provider-level monetary accounting.
- Cloud Writing drafts, cross-device restoration of an active focus-session timer.
- Audio migration/CDN changes or a licensing determination for the separate audio repository.
- New teacher review workflow: the existing review card/queue is reused rather than duplicated.
- Other legacy mini-game records (apart from Warm-Up and Boss Battle) remain device-local.
- Additional learning evidence to validate that the short-session recommendations improve outcomes.

## Dependency audit at packaging

The runtime-only audit reported no advisories after the Next.js/Auth.js/PostCSS updates.
The full audit still reports 7 advisory entries (5 high, 2 moderate) in the Tailwind 3
build/watch/parser dependency chain (`braces`, `chokidar`, `fast-glob`, `micromatch`,
`tailwindcss`, `postcss-nested`, `postcss-selector-parser`). Moving build-only packages
to devDependencies is correct classification, **not** a fix for those advisories.
Do not compile untrusted source/CSS on the production host. A separately tested Tailwind 4
migration is the remaining dependency-security milestone; do not apply force updates blindly.

## Hosting acceptance caveat

The local production build succeeds but warns that Auth.js/Jose imports compression Web APIs
not supported by Next's Edge runtime. The application's ordinary JWTs do not request compressed
JWE payloads. Still, test credential sign-in, session refresh, expiry, and protected-route redirects
on the actual hosting preview before release; local unit checks are not hosted auth certification.

## Writing retry behavior and staging tests

- Single-task `/api/learning/writing/submit` fallbacks with a configured provider create one durable job
  **inside the attempt/XP transaction**. A successful AI result or an unconfigured provider creates no job.
- Per-job compare-and-set leases expire after two minutes; completion requires the current unexpired
  token. A killed instance can be recovered. A model call that finishes but loses its lease may be paid
  twice after recovery; there is no claim of exactly-once provider billing.
- Every retry reserves the same student's `writing-submit` and platform budgets. Budget denial delays
  the job without consuming a paid attempt. Provider failures use exponential backoff, up to five tries.
- The existing authenticated daily cron processes **one due job per invocation** (shared between
  deployments). Authorized owner views of a result also attempt that job after the response when the
  hosting platform supplies `waitUntil`. No in-memory job is relied on for durability.
- This is not a minute-by-minute worker. Without result visits, a backlog may take multiple days on
  the current once-daily Hobby cron. Before enabling at school-wide volume, provision a more frequent
  authenticated scheduler and measure throughput; no five-minute completion SLA is promised.
- The result page displays a provisional/failed-retry notice; reopening shows updated feedback.
  No automatic browser polling or cross-device active-session restoration is provided.
- Delayed AI completion does not recalculate XP or historical learning/reward ledger entries.
  Both teacher save and completion lock the attempt row; a teacher's review always takes precedence.
  Completion refreshes only ungraded homework's band. Finished/graded homework is never re-graded.
- The completion notice is in-app only and commits with the result; no new Telegram delivery is implied.
  Queue rows contain error codes, not duplicated essays or provider response bodies. Deleting the
  attempt deletes its job by FK cascade. Terminal rows currently have no retention cleanup.
- Speaking, full Writing exams, mocks, and historical fallbacks are not automatically queued/backfilled.

Staging must test with real PostgreSQL/Prisma: two instances claiming the same job, a killed lease,
transaction rollback, teacher save while AI is running, budget exhaustion, provider timeout, completion
notice deduplication, FK deletion, and backlog under the intended schedule. Mock unit tests and isolated
PGlite SQL checks do not replace these hosted multi-connection checks.
