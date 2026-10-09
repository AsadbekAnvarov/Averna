# Mobile-first learning reliability — first release block

This is an independent PR against main, not stacked on draft PRs #123/#124.
No production database, hosting environment, provider, mail account or real learner was used.
Do not merge/enable as an automatic production rollout.

## Scope and honest boundaries

### Private account drafts

Single-task Writing **practice** editor only; homework drafts and full/timed Writing exam drafts retain their existing device-local behavior. The server passes `CLOUD_WRITING_DRAFTS=on` into the editor; when OFF, entry UI is absent and the API returns 404 before auth/storage work.

Device saving stays automatic. Account saving is deliberately **explicit**, not a background autosave promise. Account text is never silently loaded over device text. Learners reload, compare the read-only account copy, acknowledge replacement, then either load it or save their device copy. Loading pauses the advisory practice timer. This is not cross-device exam timing authority.

Owner is derived from authenticated STUDENT identity. Staff cannot read drafts. Content is scoped per student + task type + prompt ID; task fingerprint changes prevent loading/overwriting an obsolete draft. Server validates bounded streamed JSON, same-origin mutations, input lengths and separate shared read/write limits. Private/no-store responses; no analytics or AI provider receives draft text.

Writes lock the Student row, recheck current blacklist/profile access, then check the version. Identical replays do not increment it. Other-device conflicts never overwrite either copy. A timeout says a write might have committed and asks the learner to reload. Unmount aborts normal draft requests; expired access hides the account snapshot. If browser localStorage is unavailable, the existing local-save warning still applies.

After a submission is acknowledged, best-effort cleanup clears only the known version and attempt ID, leaving a versioned tombstone. A newer other-device revision is not cleared. Cleanup can fail/offline: an account copy may remain, and its original submission ID is retained to avoid double submission/XP. There is no guarantee of automatic draft removal, retention purge or full SPA navigation interception. Drafts cascade on Student deletion; agree retention before release. No new teacher/parent sharing.

### Writing retry scheduling

Existing queue, leases, budget checks, teacher precedence and no-XP-reaward semantics are unchanged. New authenticated `POST /api/cron/assessments` processes **at most two existing single-task Writing jobs** sequentially. It leaves time for a ~20s provider call and commit under a 60s hosting invocation. Busy/idle/unconfigured ends the batch. Existing daily cron and owner-result visits still work.

OFF unless `ASSESSMENT_SCHEDULER=on`. Requires independent `ASSESSMENT_SCHEDULER_SECRET` of 32+ characters; constant-time bearer comparison. No scheduler is provisioned by this code and no paid plan is enabled. Configure a deliberate, authenticated external cadence only after staging capacity/budget tests. For example, one invocation every five minutes is a candidate, not a promised SLA or Vercel Hobby capability.

No new accept-first submission mode, no Speaking/full Writing/mock retry jobs, no historical backfill, monetary cost ledger, exactly-once provider billing or guaranteed throughput. Those are the next queue release block. Submission/XP behavior remains the existing main behavior.

### Source-aware practice evidence

Existing AiClone and BandProgress entry points now share the same descriptive widget; no new navigation destination. Greeting text uses the same evidence language. No original score, teacher review, XP, streak, homework grade or balance is recalculated.

- Most recent 90 days, bounded to 1,000 rows with explicit truncation text. SQL selects metadata only — not essays/transcripts/answer bodies. Composite Student + completion-time index is included in the migration.
- Latest result per content key avoids overweighting repeated known material; up to six eligible results per skill.
- Reading/Listening require a known exam-v2 keyed result with an attempted answer. Only 40/40 answered whole papers qualify as complete evidence.
- Writing excludes heuristic/unknown-source estimates without teacher review. Task-specific practice can show a median, but only same-sitting Task 1 + Task 2 pairs form a complete paper; Task 2 weighted twice.
- Speaking requires teacher-reviewed recorded work with no typed responses. Complete evidence additionally requires words/time in Parts 1/2/3 and a saved teacher pronunciation criterion. Transcript-only AI scores cannot establish pronunciation/full speaking readiness.
- Overall needs at least two complete distinct-content results on different **Tashkent calendar days** in each skill. Equal skill weighting, not weighting by how often a learner practises one module.
- Median and observed min/max are descriptive, **not** a validated forecast/confidence interval. Zero is not discarded; no optimistic momentum is added. The two-result rule is a conservative product threshold, not psychometric validation.

Older Future Self, teacher-intelligence/memory forecasting helpers still use the legacy predictBand function and are outside this block. Do not claim a global forecasting-engine rewrite. The teacher essay-review UI no longer presents an AI-authorship percentage as proof; the underlying legacy signal remains a caution, not a disciplinary decision.

### Mobile improvements

Actual existing shared student Dashboard/Progress/Rankings/staff tab components: readable 14px labels, scoped horizontal scroll, 44px phone targets. Shared Button and dictation control have phone-sized targets without enlarging desktop icon defaults.

Single-task editor: non-sticky prompt on phones, full-width wrapping submission action, 16px labelled textarea, shorter initial field height, vertically stacked tips/actions; account controls are **after the essay**, not before it. Topic list wraps titles/type badges and moves Start below text on phones.

Teacher Smart Essay Review: result summary stacks on phones, criteria no longer compete with overall for a narrow row, labelled 16px input/feedback, 44px Task controls, wrapping title and stacked result actions. Averna AI quick prompts get 44px targets and a labelled 16px question field.

Synthetic QA covers 320/390px phones, 768px tablet, 1440px desktop, both themes across cases, failed network, explicit comparison/restore and conflict preservation. This is not an audit of every portal route or real iPhone Safari/keyboard/VoiceOver/audio behavior.

## Explicit rollout

1. Restore-test a backup, preserve a known-good deployment and verify an isolated staging DB identity/history. Never seed production or execute historical baseline CREATE statements against populated tables.
2. Inspect `prisma migrate status` and read-only drift. Reconcile independently developed PR migration histories, especially #123/#124. No reset/data-loss flags.
3. Apply `20261009000300_writing_drafts/migration.sql` via the approved versioned migration process to staging only. It creates one table + constraints + composite IELTS index. Review index build time on existing data. It is intentionally **not** added to legacy automatic deploy.sql.
4. Generate Prisma client. Deploy staging, enable CLOUD_WRITING_DRAFTS there, then complete acceptance below. The read-only widget uses existing tables even when drafts are OFF; its performance index is recommended before school-wide rollout.
5. Configure scheduler secret only in hosting settings. Enable scheduler on staging and test authenticated execution, concurrent invocations, budget denial and backlog. No secret belongs in Git or screenshots.
6. Production requires separate authorization, backup/drift review, approved migration and explicit feature activation. UI/availability rollback: remove flags/redeploy; preserve draft rows, do not DROP.

## Mandatory staging acceptance

- Two authenticated devices for one learner: save/load, local and remote edits, stale writes, lost save response, restore confirmation, concurrent saves and submitted-attempt cleanup versus a newer revision.
- Different student/staff/parent, signed-out, blacklisted account, deleted profile, changed task, direct API call, both feature-OFF routes, limiter/storage failures. Draft text must not enter error logs or another account cache.
- Real multi-connection PostgreSQL with pool size 1: lock/version behavior and rollback; PGlite is not a concurrency certification.
- Real provider and hosting timeouts for Writing retry, competing teacher review, scheduler concurrency and provider budget. Existing aggregate/full-exam results must remain untouched.
- Actual phone Safari/Chrome: keyboard open, rotate, back/reload, long title/essay, large text, light/dark and reduced motion. Check existing authenticated portal screens too.
- Retention/privacy decision for drafts and scheduler secret rotation.

## Reproducible local checks

Node 20.19+, 22.12+ or 24 (Vitest 4 uses Vite 8). Vitest updated to 4.1.11; JSX test transform uses Oxc automatic runtime. This fixes the two current critical Vitest/Tinypool audit entries, not every development advisory.

```
npm ci
npm test
npx tsc --noEmit
npx next lint --max-warnings=0
npx prisma validate
npm run build                 # NEVER vercel-build against an unverified DB
npm audit
npm audit --omit=dev
```

For isolated SQL/UI smoke tools, install @electric-sql/pglite, esbuild and playwright in a separate disposable folder. Do not change the app lockfile to run them:

```
NODE_PATH=/path/to/qa/node_modules node scripts/verify-writing-drafts.cjs
NODE_PATH=/path/to/qa/node_modules CHROMIUM_PATH=/path/to/chromium node e2e/mobile-learning.cjs
```

UI fixture uses real components and app Tailwind/theme tokens with synthetic text and mocked network/navigation; no login, cloud provider or real DB. Screenshots require visual review. The fast synthetic mobile check is ready to run separately from the existing authenticated Screens workflow. Mandatory CI wiring is prepared locally but not included in this commit: the connection rejected workflow writes. Apply the workflow patch only with an appropriately authorised connection.
