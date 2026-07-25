# Averna Core Engine — Architecture Report

> **Scope.** This is the *second* architecture document. The first
> (`docs/ARCHITECTURE_AUDIT.md`) audited the platform and defined a 5-phase roadmap;
> Phases 1–4 of that roadmap are now **implemented and in the release branch**.
> This report therefore does not re-audit from scratch. It (a) records what is now
> real, (b) specifies the **Averna Core Engine** — one unified engine composed of
> connected modules, (c) maps integration, (d) gives a safe migration plan, and
> (e) answers the QA/scale questions honestly.
>
> **Constraint respected throughout:** no page is redesigned, no interface replaced,
> no system removed. Every change is behind the existing UI.

---

## 0. Where we actually are

**Implemented this cycle (already merged into the release branch):**

| Capability | Status | Where |
|---|---|---|
| Server-side scoring (Listening/Mock) from the answer key | ✅ done | `app/api/learning/*/submit` |
| Strict reading answer matching | ✅ done | `lib/utils.ts:isTextAnswerCorrect` |
| Rank computed on read (O(1) XP writes) | ✅ done | `lib/db-helpers.ts:getGlobalRank` |
| XP Engine 2.0 (growth, difficulty, repeat-decay, daily cap) | ✅ done | `lib/xp.ts` |
| Verified streak (learning, not logins) | ✅ done | `updateStudentPoints → updateStudentStreak` |
| Server SRS ledger + retention-XP | ✅ done | `ReviewItem`, `app/api/srs/review` |
| Evidence-based mastery lifecycle | ✅ done | `lib/student-intel.ts:getSkillStages` |
| Writing relevance gate | ✅ done | `lib/utils.ts:isOnTopic` |
| Evidence-linked AI (stages + SRS in context) | ✅ done | `app/api/averna-ai`, `lib/ai.ts` |
| Teacher radar retention-decay signal | ✅ done | `lib/teacher-intel.ts` |
| Deploys can no longer wipe the DB | ✅ done | `package.json` (flag removed) |

**Conclusion:** the *educational logic* problems from the first audit are largely
solved. What remains is **structural**: the logic is correct but lives in scattered
call sites with no single authority, no persistence of derived state, and no
integrity ledger. That is what the Core Engine addresses.

---

## 1. Phase 1 (delta audit) — what is still wrong

Only genuinely open issues. Each is grounded in current code.

### 1.1 No single XP write authority — **Critical**
- **Current State.** `updateStudentPoints()` is the intended authority, but **three
  call sites bypass it and mutate `totalPoints` directly**: reward redemption
  (`app/rewards/page.tsx`), admin refund on rejection (`app/admin/rewards/page.tsx`),
  and teacher bonus points (`app/teacher/students/page.tsx`).
- **Problems.** Bypasses skip the verified-streak hook, skip any future integrity
  checks, and skip a consistent audit trail. Teacher bonus XP is uncapped and
  unaudited against the XP model.
- **Educational risk.** XP stops being a comparable measure of learning — a teacher's
  discretionary grant is indistinguishable from earned mastery on the leaderboard.
- **Technical risk.** Any future rule (caps, trust scaling, idempotency) must be
  duplicated in 4 places, guaranteeing drift.
- **Business risk.** Leaderboards/levels become disputable; hard to explain to parents.
- **Recommended Architecture.** `XpEngine.award({ studentId, source, amount?, context })`
  as the **only** writer of `Student.totalPoints`. All grants (earned, spend, refund,
  teacher bonus) flow through it with a typed `source`, and every call writes an
  `ActivityLog` row. Direct `totalPoints` writes forbidden by convention + a grep-able
  lint rule.
- **Implementation Plan.** Add `lib/engine/xp-engine.ts` wrapping the existing
  `updateStudentPoints`; migrate the 3 bypass sites; keep `updateStudentPoints` as a
  thin deprecated alias for one release.
- **Priority** Critical · **Impact** High · **Difficulty** Low · **Dependencies** none.
- **Future Expansion.** Trust-scaled awards, seasonal multipliers, XP reversal on
  detected abuse.

### 1.2 Schema drift between Prisma and the seed's raw DDL — **Critical** (root cause of the data-loss incident)
- **Current State.** `prisma/schema.prisma` defines **37 models**. `app/api/seed/route.ts`
  contains a **hand-written `CREATE TABLE IF NOT EXISTS` list** that covers the older
  tables but **not** `Commitment`, `ReviewItem`, or `GeneratedTest` (verified: no match).
- **Problems.** Two competing sources of truth for DDL. The hand-written tables don't
  match Prisma's expectations exactly, so `prisma db push` sees drift and wants a
  destructive reconciliation — which is precisely why `--accept-data-loss` was added
  and why **accounts/XP were wiped**. The flag is gone, but the *drift* remains, so
  the next deploy can now **fail** instead (safe, but blocking).
- **Educational/Business risk.** Recurrence of total data loss = loss of trust; the
  single worst failure mode this platform has.
- **Recommended Architecture.** **Delete the DDL from the seed.** Schema is owned by
  Prisma alone. The seed becomes data-only (idempotent upserts). Introduce real
  **`prisma migrate`** history so schema change is versioned and reviewable, and the
  deploy runs `migrate deploy` (never destructive) instead of `db push`.
- **Implementation Plan.** (1) `prisma migrate diff` the live DB → baseline migration;
  (2) commit `prisma/migrations/`; (3) switch `vercel-build` to `prisma migrate deploy`;
  (4) strip DDL from the seed; (5) verify on a Neon **branch** first.
- **Priority** Critical · **Impact** Very High (eliminates the data-loss class)
  · **Difficulty** Medium · **Dependencies** DB snapshot + a Neon test branch.

### 1.3 Derived state is never persisted (no learning history) — **High**
- **Current State.** `getSkillStages()` recomputes the mastery lifecycle **per request**
  from test history. Nothing records *when* a skill advanced.
- **Problems.** No transition history → can't celebrate "you reached Verified", can't
  chart mastery velocity, can't let a teacher/admin see progression over time, and
  decay can't be detected between sessions (only recomputed).
- **Educational risk.** The most motivating moment (stage advancement) is invisible;
  retention decay is noticed only if the student happens to open the page.
- **Technical risk.** O(history) recomputation on every dashboard render; can't index
  or aggregate stages for cohort analytics.
- **Recommended Architecture.** `SkillState` table (studentId, skill, stage,
  evidenceCount, distinctDays, lastVerifiedAt, decayAt) written by a
  **ProgressEngine.reconcile(studentId)** invoked after each verified event. Reads
  become O(1) lookups; `getSkillStages` stays as the pure derivation used by reconcile.
- **Priority** High · **Impact** High · **Difficulty** Medium · **Dependencies** 1.2
  (do migrations first — never add tables via `db push` again).

### 1.4 Anti-cheat is per-route and ad hoc; no integrity ledger — **High**
- **Current State.** Real but scattered gates: `isGenuineWriting`, `isOnTopic`,
  `answeredCount>0 && correct>0`, repeat-decay, daily caps. No timing analysis, no
  guess-pattern detection, no persisted flags, and rewards are binary (full or zero).
- **Problems.** Cannot answer "is this student's progress trustworthy?"; abuse leaves
  no trace; honest edge cases get a hard zero instead of a reduced award with an
  explanation.
- **Educational risk.** Random-clicking through a 40-question listening test still
  yields a real band if a few answers happen to be right.
- **Recommended Architecture.** **IntegrityEngine.assess(submission) → { trust: 0..1,
  signals[], explanation }**, consumed by XpEngine as a *multiplier* (graceful, not
  binary), with flags persisted to an `IntegrityFlag` ledger for admin visibility.
  Signals: accuracy≈chance, time-per-item below a human floor (server-measured),
  answer entropy, prompt-overlap for writing, award velocity.
- **Priority** High · **Impact** High · **Difficulty** Medium · **Dependencies** 1.1.

### 1.5 Achievements are hardcoded, count-based, and expensive — **Medium**
- **Current State.** 8 fixed `AchievementType`s; `checkAndAwardAchievements()` loads
  **all** of a student's submissions, tests, speaking sessions and achievements on
  **every** test/homework save, then compares raw counts (e.g. 100 reading tests).
- **Problems.** Rewards volume, not mastery (100 tests ≠ competence). Full-relation
  load per save is a scale hazard. Adding an achievement requires a schema enum change.
- **Recommended Architecture.** **AchievementEngine** with a **declarative rule table**
  (JSON/TS predicates over an aggregated `StudentSnapshot`), evaluated against
  counters rather than full relation loads, and able to reward *mastery/retention*
  stages, not just counts.
- **Priority** Medium · **Impact** Medium · **Difficulty** Medium · **Dependencies** 1.3.

### 1.6 Client-only mini-games remain unverifiable — **Medium**
- **Current State.** Ghost Race, Boss Battle, Word Duel, Confidence Meter, Focus Vault
  keep records in `localStorage`; they grant no server XP (good for integrity) but are
  disconnected from learning.
- **Recommended Architecture.** For the games that genuinely test recall (Word Duel,
  Confidence Meter, Boss Battle — they use real vocabulary/mistakes), submit results
  through the SRS/verification path so correct recall earns capped retention-XP and
  updates review scheduling. Pure-timer games (Focus Vault) stay cosmetic by design.
- **Priority** Medium · **Impact** Medium · **Difficulty** Medium.

### 1.7 Admin analytics still lean on vanity metrics — **Medium**
- **Current State.** `activeWeek`/`activeToday`/`inactive14` derive from
  `lastActiveDate`, and headline numbers are counts (tests today, new students).
  (Note: `lastActiveDate` now means *verified learning*, which already improved it.)
- **Recommended Architecture.** **AdminAnalyticsEngine** exposing outcome metrics:
  verified-learning rate, mastery velocity (stage advances/week), retention (SRS due
  completed), teacher effectiveness (mean band delta per teacher), at-risk cohort size,
  integrity-flag rate. Same cards, meaningful numbers.
- **Priority** Medium · **Impact** High (decision quality) · **Difficulty** Medium
  · **Dependencies** 1.3, 1.4.

### 1.8 No idempotency; retries can double-award — **Medium**
- **Current State.** Client buttons disable on submit (verified), but a network retry
  or duplicate POST re-runs the full award path.
- **Recommended Architecture.** Accept a client-generated `submissionId` (UUID);
  XpEngine records it and treats a repeat as a no-op returning the original result.
- **Priority** Medium · **Impact** Medium · **Difficulty** Low.

### 1.9 AI cost/abuse exposure at scale — **Medium**
- **Current State.** AI routes (`averna-ai`, briefing, essay review, generation) call
  GPT-4o per request; only the admin briefing is day-cached (client-side).
- **Risk.** At 100k students this is an unbounded spend and a DoS-by-cost vector.
- **Recommended Architecture.** Per-user rate limits + server-side response cache
  keyed by (student, data-fingerprint, day); queue long generations; hard monthly caps.
- **Priority** Medium · **Impact** High (cost) · **Difficulty** Low–Medium.

### 1.10 Band prediction overstates confidence — **Low/Medium**
- **Current State.** `predictBand` = recency-weighted mean + momentum; `confidence`
  is a pure sample-count bucket ("high" at ≥8) regardless of variance, and mixes
  modules for the overall figure.
- **Recommended Architecture.** Keep as v1 but make confidence variance-aware
  (wide spread ⇒ lower confidence), predict **per skill** and aggregate, and label it
  an *estimate* everywhere. Move toward an ability model when data volume allows.
- **Priority** Low–Medium · **Impact** Medium (trust) · **Difficulty** Low.

---

## 2. Phase 2 — the Averna Core Engine

One engine, thirteen modules, two hard rules:

> **Rule A — Single authority.** Exactly one module may write each concept:
> XP → XpEngine · mastery → ProgressEngine · scheduling → MemoryEngine ·
> badges → AchievementEngine. No route mutates these directly.
>
> **Rule B — Evidence in, evidence out.** Any module that influences a student's
> record or advice must carry the evidence that justified it.

Proposed home: `lib/engine/*` (thin modules wrapping today's proven logic — this is a
**re-organisation, not a rewrite**).

| Module | Purpose | Inputs | Outputs | Key rules | Failure handling |
|---|---|---|---|---|---|
| **VerificationEngine** | Decide whether a submission is genuine learning | raw answers, essay, prompt, server timing | `{ verified, correctness, effort }` | server-side scoring only; answer key never leaves the server | invalid content ⇒ save, don't reward |
| **IntegrityEngine** | Quantify trust; expose abuse | submission + history | `trust 0..1`, signals, flags | scale rewards, never hard-punish; always explain | unknown ⇒ trust 1 (fail open, log) |
| **XpEngine** | Sole writer of XP | verified result, difficulty, repeat count, trust, daily total | XP delta + ActivityLog | growth > volume; repeat-decay; daily cap; idempotent | award failure must not lose the test record |
| **ProgressEngine** | Own the mastery lifecycle | verified events, review outcomes | `SkillState` transitions | stage advances need repeated, multi-day evidence; decays | reconcile is idempotent & replayable |
| **MemoryEngine** | Own scheduling & forgetting | review ratings (SM-2) | `ReviewItem` due dates, retention | due-only reviews earn XP; capped | offline client mirrors later |
| **AchievementEngine** | Award badges from rules | StudentSnapshot | unlocked badges + XP via XpEngine | declarative rules; mastery-based | duplicate award impossible (unique) |
| **MotivationEngine** | Model the human side | streak, habits, mood, recent wins | tone, nudge timing, celebration triggers | never nag before usual study time | silent when no signal |
| **RecommendationEngine** | Decide *what to study now* | SkillState, due reviews, homework, weakest skill | ranked actions + reason | due reviews first; then weakest skill | empty ⇒ "take a test" |
| **AiDecisionEngine** | Turn the model into language | StudentModel bundle | grounded reply | cite the datum; never invent; admit gaps | template fallback (already built) |
| **PredictionEngine** | Estimate bands honestly | per-skill history | per-skill + overall estimate, variance-aware confidence | always labelled an estimate | <2 samples ⇒ no prediction |
| **TeacherIntelligenceEngine** | Make teaching decisions easy | class signals, SkillState, decay | radar, tips, priority queue | every categorisation carries a reason | partial data ⇒ omit, don't guess |
| **AdminAnalyticsEngine** | Institutional truth | aggregates | outcome metrics, integrity rate | no vanity metrics | slow query ⇒ cached snapshot |
| **NotificationEngine** | Right message, right moment | events from all engines | notifications/toasts | respect quiet hours & dedupe | never block a learning write |

`StudentModel` (read-only bundle assembled once per request and shared) becomes the
common language between engines — today's `student-intel` + `habits` + `memories` +
SRS counts, unified and `React.cache`d exactly like `getStudentTests` already is.

---

## 3. Phase 3 — integration map

```
        submission (raw answers / essay / review rating)
                          │
                 VerificationEngine ──────────► (invalid) save only, explain
                          │ verified
                  IntegrityEngine  ──────────► IntegrityFlag ledger ──► Admin
                          │ trust
                      XpEngine ─────────────► ActivityLog ──► streak, leagues
                     │      │
        ProgressEngine      AchievementEngine ──► NotificationEngine
              │                    │
        MemoryEngine ◄─────────────┘
              │
         StudentModel  ◄── MotivationEngine
          │        │
RecommendationEngine   PredictionEngine
          │                 │
      AiDecisionEngine ◄────┘
          │
   TeacherIntelligenceEngine ──► AdminAnalyticsEngine
```

Read direction only ever flows **from** the ledgers; nothing downstream writes back.
That single property is what makes the ecosystem debuggable at scale.

---

## 4. Phase 4 — migration strategy (safe, incremental, reversible)

Each step is independently deployable, UI-invisible, and rollback-safe.

| # | Step | Complexity | Backward compat | Testing | Rollback |
|---|---|---|---|---|---|
| **S0** | **Baseline `prisma migrate` + strip DDL from seed** (1.2) | Medium | Full — no app change | Run on a **Neon branch** first; verify `migrate deploy` is non-destructive | Revert build script; DB untouched |
| **S1** | `XpEngine.award` + migrate 3 bypass sites (1.1) | Low | `updateStudentPoints` kept as alias | Award/spend/refund/bonus paths | Revert commit; data intact |
| **S2** | Idempotency keys (1.8) | Low | Optional field; absent ⇒ current behaviour | Duplicate-POST test | Ignore the field |
| **S3** | `IntegrityEngine` in **shadow mode** — compute & log trust, do **not** apply | Medium | Zero behaviour change | Compare flags vs real submissions for 1–2 weeks | Feature flag off |
| **S4** | Apply trust as an XP multiplier, with student-facing explanation | Low | Gradual (floor the multiplier initially) | Honest-student regression check | Flag off ⇒ trust=1 |
| **S5** | `SkillState` table + `ProgressEngine.reconcile` (1.3); dashboards read the table, falling back to live derivation | Medium | Fallback keeps UI working pre-backfill | Backfill replay vs live derivation must match | Read from derivation again |
| **S6** | SRS becomes read-authoritative + cross-device seeding | Medium | localStorage remains a cache | Two-device sync test | Client-only mode |
| **S7** | `AchievementEngine` rule table (1.5) | Medium | Same 8 badges first, then extend | No duplicate/no lost badges | Old checker |
| **S8** | `AdminAnalyticsEngine` outcome metrics (1.7) | Medium | New metrics beside old for one release | Cross-check against raw SQL | Show old numbers |
| **S9** | AI rate limits + server cache (1.9); variance-aware confidence (1.10) | Low | Transparent | Load test; cost ceiling | Disable cache |
| **S10** | Connect recall mini-games to MemoryEngine (1.6) | Medium | Games keep working standalone | Anti-farm caps | Client-only |

**Non-negotiable:** **S0 ships before any new table.** The data-loss incident was
caused by schema drift; adding tables via `db push` while drift exists is what turned
a routine deploy into a wipe.

---

## 5. Phase 5 — QA & scale answers (honest)

**Can users cheat?** Score forging: no (server-side keys). Random-guessing a real band:
**still yes today** → S3/S4. XP farming by retakes: no (repeat-decay). Off-topic essay
XP: no. Teacher-granted XP inflation: **yes, unaudited** → S1.

**Can users exploit rewards?** Coins/rewards spend paths bypass XpEngine (S1). SRS-XP
is interval- and cap-limited. Cosmetics are cosmetic-only — fairness preserved by design.

**Can AI make incorrect assumptions?** It cannot invent data (prompt-constrained,
fallbacks grounded), but it can over-trust a thin sample → S9 (variance-aware
confidence) and always labelling predictions as estimates.

**Can teachers misread data?** Every radar category ships a reason string — good. Gap:
band figures don't display their confidence → surface it (S9).

**Can admins decide wrongly?** Today, partly — counts can look healthy while learning
stalls. S8 fixes this.

**Scale to 100k?** XP writes are O(1); rank is an indexed count; test history is
`React.cache`d once per request. Remaining hot spots: `checkAndAwardAchievements`
full-relation load per save (S7), unbounded AI spend (S9), per-request lifecycle
recomputation (S5).

**Scale to millions?** Needs the above **plus**: read replicas for analytics,
snapshot/materialised aggregates instead of live scans, background job runner
(reconcile/decay/rankings), partitioned `ActivityLog`, and CDN-cached static content.
Architecturally the single-authority design supports it; the work is infrastructural.

---

## 6. Recommended execution order

1. **S0 — migrations + seed DDL removal.** Eliminates the only catastrophic failure
   mode. Nothing else should ship first.
2. **S1 + S2 — XP single authority + idempotency.** Small, high-integrity wins.
3. **S3 → S4 — Integrity in shadow, then enforced.** Closes the last real cheat.
4. **S5 — persisted mastery.** Unlocks celebration, velocity, cohort insight.
5. **S8 + S9 — trustworthy admin metrics, controlled AI cost.**
6. **S6, S7, S10 — retention depth, declarative badges, connected games.**

**Estimated effort:** S0–S2 ≈ 1 focused day · S3–S5 ≈ 3–4 days · S6–S10 ≈ 1 week.
All of it fits behind the current interface.

---

## 7. What this achieves

The first cycle made Averna's rewards *honest*. This cycle makes them *governable*:
one authority per concept, evidence attached to every decision, derived state
persisted, integrity observable, and cost bounded — with the supercar's body
completely untouched.
