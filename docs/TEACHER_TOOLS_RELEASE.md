# Teacher tools — stage 2 (ideas 6 and 7)

This change is stacked on stage 1 (PR #123), not a replacement for it. Review the stage-2 diff against `feat/feedback-practice-portfolio`. Merge/review #123 first, then retarget the stage-2 PR to main and verify the resulting diff/checks. The first PR is not modified. The new services do not depend on enabling the learning-cycle feature; their flags are independent.

## Live classroom

- Teacher Workspace and group pages link to `/teacher/classroom`; enrolled learners join `/learning/classroom` from their existing **Class** dashboard tab. Administrators can enter through **System → Teaching tools**. No new global sidebar sections or public room codes.
- Staff open a lesson for a group. Learners explicitly send **I understand**, **I need an example**, or **I have a question** (with bounded question text). Each learner has one latest signal, with optimistic versions to reject stale writes.
- Teacher/admin view has named signals and a question/example filter. Learners receive no roster, peer questions or peer answer identities. Signals are **not anonymous**; this is stated before participation. No automatic parent sharing.
- A teacher-authored 2–4-option understanding check accepts one immutable answer per learner. Staff can see the key and distribution; learners cannot receive the key/explanation/distribution in API JSON until the check closes. Closing a lesson closes its open check too.
- Participation does not change attendance, IELTS results, homework grades, XP, balances or AI jobs. No AI generation, recording, external messages or notifications are added.
- The interface polls roughly every **8 seconds while visible**, not WebSocket/sub-second streaming. Refresh timestamps disclose snapshot age. A client request aborts after 12 seconds to release controls; the message notes that a timed-out write may already be committed and can be retried safely. No signal does not imply lack of understanding; participation is not an online/presence tracker.
- Unsent questions and teacher check drafts survive refresh and lesson transitions in the same page. A changed lesson warns the learner to verify its new topic. Unload warnings are provided; full navigation/reload can lose unsaved text, and not every SPA navigation is intercepted. There is no local-storage persistence. If access expires or is revoked, the workspace is removed for privacy and unsent form state can be lost; drafts are not promised across account/permission changes.
- V1 shows the latest lesson/check, not a historical report. Up to 300 enrolled learners per group, and 200 group choices per staff page; larger cohorts need a scoped/paginated design before enabling. Lessons/signals/checks remain stored until an approved retention process or cascade deletion. No automatic purge job is added.

## Private assessment calibration

- `/teacher/calibration` is available from Teacher Workspace / Review Queue. Administrators publish references via the same page, reachable from Admin **System**.
- No example is silently seeded as a real benchmark. Start with an empty library. The administrator must use synthetic or properly anonymised material, supply complete task/source data, record all four Writing criterion values plus agreed rationale, and explicitly confirm academic-lead agreement and absence of identifying learner information.
- This checkbox is a human confirmation, **not** automated anonymisation or a multi-person approval workflow. The academic lead must actually review the text/criteria before publication.
- Teacher commits all criterion scores, an exact evidence quote and independent reasoning before the centre values and rationale are sent by the server. First assessment is immutable; identical retries are harmless, altered retries conflict. Reference author cannot do blind practice on their own reference.
- Comparison contains signed per-criterion differences (own minus reference), not an overall teacher score, public leaderboard or staff performance ranking. Only the current user's own ratings are returned, including for administrators.
- Published references are immutable in v1; revisions should be published as a new titled reference. Publication uses a request ID to avoid duplicate records after a lost response. No public link is provided.
- Writing Task 1/2 only. Speaking calibration is deliberately excluded until a properly licensed/anonymised audio reference and agreed pronunciation/delivery assessment protocol exist. These are **centre-agreed**, not official IELTS examiner-certification benchmarks.

## Security / consistency

Authenticated server identity determines the actor; client user/role fields do not grant permissions. Unsupported roles are denied. Current group teacher/admin sees the room; only currently enrolled, non-blacklisted learners write signals/answers. All mutations lock the group and repeat membership checks on the same transaction connection. Snapshots use repeatable-read transactions. Reads remove transferred learners' signals/answers from the current roster and aggregate counts. Reassigned teachers lose room access; failed 401/403/404 refresh hides a stale roster in the UI.

Partial unique indexes enforce one open lesson per group and one open check per lesson. Immutable question publications have request IDs, identical retries do not duplicate rows, and audit writes are atomic with staff actions/calibration. Mutation routes have same-origin checks, bounded streamed JSON, fail-closed write limits and private/no-store responses. Error logs contain error types, never the posted response/question or SQL detail. An origin-less CLI still requires authentication.

## Controlled release — both OFF by default

Flags:

- `LIVE_CLASSROOM=on`
- `TEACHER_CALIBRATION=on`

With flags unset, entry links are absent, new pages not-found and APIs return 404 before auth/database work. These are server environment flags, not NEXT_PUBLIC settings.

Migration: `prisma/migrations/20261009000200_teacher_tools/migration.sql` (six additive tables, their FK/check/index constraints). It is intentionally **not appended to legacy `prisma/sql/deploy.sql`**. Do not enable either feature on a preview pointing at an unmigrated/shared production database. Do not use `db push` or an auto-generated replacement migration to bypass the reviewed SQL partial unique indexes.

1. Verify a disposable/staging database identity and existing migration history. Do not run historical baseline CREATE statements against a populated production DB. Review `docs/RUNBOOK_DB_MIGRATIONS.md` and stage-1 rollout instructions.
2. On the verified staging database only, apply this additive file using the approved migration process, e.g. `psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/20261009000200_teacher_tools/migration.sql`. Track it in the deployment/migration record.
3. Generate Prisma client/build as usual, enable the chosen flag(s) and redeploy **staging**. Do not claim a merged PR automatically completed production migration.
4. Complete acceptance below. Agree privacy/retention and benchmark ownership with the centre. For production, verify a restorable backup, review migration/schema drift, apply in a controlled window, then enable flags/redeploy.
5. Availability rollback: remove flags and redeploy. Preserve participation/reference data, not DROP tables. User deletion cascades own signals/answers/ratings; reference author/session creator can become null, and group/session/reference deletion cascades its child records.

### Staging acceptance still required

- Two real authenticated browsers: teacher opens lesson, learner signals, teacher sees change at next foreground poll; publish/answer/close/reveal; close/start a new lesson with unsent text preserved.
- Another group/teacher, unsupported role, blacklist, missing profiles/groups, stale tabs, group/teacher reassignment, API direct requests and feature-off routes.
- Real multi-connection PostgreSQL races: simultaneous START/publish, signal updates, duplicate answers and answer-vs-close; verify unique records and no grade/XP/attendance side effects. Run with a pool size of 1 and confirm no nested-connection authorization deadlock.
- Reference administrator vs other staff: empty library, valid anonymised publication, exact quote validation, blind HTTP payloads (no centre scores/rationale), independent submission, private comparison and immutable first assessment. Try another user's ratings: none should be returned.
- Audit failure/rollback, rate limiter outage, transient offline/failed save, access revoked during refresh; inspect logs for absence of submitted material. Unsent fields must stay after normal failed requests.
- Mobile/desktop keyboard and focus, long questions/options/names, end-lesson confirmation, library pagination and current cohort size. Load-test the 8-second polling cadence before enrolling many concurrent classes; no platform-wide capacity claim is made.

## Local verification

```sh
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next lint
./node_modules/.bin/next build
DATABASE_URL=postgresql://qa:qa@localhost:5432/qa ./node_modules/.bin/prisma validate
NODE_PATH=/path/to/isolated/node_modules node scripts/verify-teacher-tools.cjs
NODE_PATH=/path/to/isolated/node_modules node scripts/verify-learning-cycle.cjs
```

The smoke scripts use separately installed `@electric-sql/pglite`, load all migrations + legacy SQL into a temporary isolated DB, and bundle/invoke the **actual services** with a DB adapter. They never read `DATABASE_URL` or connect to a live service. PGlite verifies SQL/flow, not real concurrent PostgreSQL connection behavior. Use `next build`, not `vercel-build`, for safe local compilation. Synthetic UI fixtures are test-only and are not seeded into app data.

Remaining roadmap: admin action queue + waitlist (11/12), then read-only finance scenarios (13).
