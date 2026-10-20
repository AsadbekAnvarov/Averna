# Averna — Architectural & Educational-Integrity Audit

> Goal: keep the beautiful UI exactly as-is, and rebuild the **internal logic** so every
> reward, level, achievement and AI decision reflects **verified learning** — not clicks.
> Nothing here requires a redesign; every item is a logic/data change behind the existing screens.

This audit is grounded in the actual code (file paths cited). Priorities: **Critical / High / Medium / Low**.

---

## 0. Executive summary — the 5 things that matter most

| # | Finding | File | Risk |
|---|---------|------|------|
| 1 | **Listening (and Mock) scores are trusted from the client** — the server saves the band from a client-sent `correctCount`. Anyone can POST a perfect score → Band 9 + full XP. | `app/api/learning/listening/submit/route.ts` | **Critical** |
| 2 | **XP = `score × 10`, flat, per submission, no cooldown** → retake the same test (answers now known) to farm unlimited XP; easy tests outrank hard mastery. | `lib/db-helpers.ts` `saveIELTSTest` | **High** |
| 3 | **Streak grows just by opening the dashboard** — no learning required. | `lib/db-helpers.ts` `updateStudentStreak`, `app/dashboard/page.tsx` | **High** |
| 4 | **`updateRankings()` rewrites every student's rank on every points change** (O(N) writes per XP event) → write storm, won't scale past a few hundred students. | `lib/db-helpers.ts` `updateRankings` | **High** |
| 5 | **A genuinely good spaced-repetition engine exists but is client-only** (localStorage), disconnected from XP, mastery, AI and cross-device sync. | `lib/srs.ts`, `components/learning/mistake-bank.tsx` | **High (opportunity)** |

The core theme: **the engine measures activity, not learning.** The fixes below convert it to measuring learning, without touching the interface.

---

## STEP 1 — Full audit (issue by issue)

### 1.1 Listening/Mock scores are client-trusted — CRITICAL
- **Current behavior:** `listening/submit` reads `{ correctCount, totalQuestions }` from the request body and computes the band directly from them. `mock/submit` similarly derives section bands from client-provided counts. No comparison against an answer key on the server.
- **Problem:** A user (or a script) can send `{correctCount: 40, totalQuestions: 40}` and receive Band 9 + full XP, achievements and rank. Reading is safe (it recomputes from `READING_TESTS[testId]`), which makes the inconsistency worse — it proves the right pattern exists but wasn't applied.
- **Educational impact:** Destroys the meaning of every band, prediction, ranking and AI recommendation downstream.
- **Risk:** **Critical.**
- **Recommended redesign:** Server-side scoring only. The client submits **raw answers**; the server holds the answer key (as reading already does) and computes `correctCount`.
- **Technical approach:** Give listening tests a server-side data file with answer keys (mirror `reading-tests-data.ts`). In `listening/submit`, accept `{ testId, answers }`, look up the key, compute correctness server-side. For Mock, score each section server-side from raw answers/essay.
- **Migration:** Additive — change the client to POST `answers` instead of `correctCount`; keep accepting the old shape for one release behind a feature flag, then remove.
- **Expected improvement:** Closes the single biggest integrity hole; makes listening bands trustworthy.
- **Priority:** **Critical.**

### 1.2 Reading string-answer matching is too loose — Medium
- **Current behavior:** For text answers, `isCorrect = normalized === correct || normalized.includes(correct)`.
- **Problem:** `includes` over-credits — correct `"true"` matches an answer like `"it is not true"`; short keys match unrelated text.
- **Educational impact:** Inflated reading bands.
- **Risk:** **Medium.**
- **Recommended redesign:** Exact match after normalization, with an explicit accepted-answers array per question (e.g. `["colour","color"]`) and typo tolerance via Levenshtein distance ≤1 for long answers only.
- **Technical approach:** Extend the question schema with `accepted: string[]`; replace the `includes` branch.
- **Migration:** Backfill `accepted` from existing `correctAnswer`; deploy scorer change together.
- **Expected improvement:** Accurate reading grading; fewer false positives.
- **Priority:** Medium.

### 1.3 XP is flat and farmable — High
- **Current behavior:** `saveIELTSTest` awards `Math.round(score * 10)` on **every** submission; `updateStudentPoints` just increments. No cooldown, no "first attempt", no diminishing returns, no difficulty weighting.
- **Problem:** Retaking the same test (answers now known) farms XP indefinitely; 20 easy Band-5 tests beat 3 hard Band-8 tests. XP rewards volume, not growth.
- **Educational impact:** Leaderboards and levels stop reflecting skill; motivates grinding over learning.
- **Risk:** **High.**
- **Recommended redesign:** **XP Engine 2.0** (see Step 4) — reward improvement, difficulty, mastery and retention; heavily discount repeats of the same content.
- **Technical approach:** Central `awardXp(studentId, source, context)` that computes XP from deltas + difficulty + repeat-decay, and is the ONLY writer of points.
- **Migration:** Route all existing award sites through `awardXp`; keep totals monotonic (never retro-remove earned XP).
- **Expected improvement:** XP becomes a real growth signal; farming collapses.
- **Priority:** High.

### 1.4 Streak measures attendance, not learning — High
- **Current behavior:** `updateStudentStreak` runs on dashboard load; `daysDiff === 1` bumps the streak. Opening the page is enough.
- **Problem:** "Illusion of progress" — the flame grows without any study.
- **Risk:** **High.**
- **Recommended redesign:** A day counts toward the streak only when a **verified learning event** occurs (a scored test with genuine effort, an SRS review, a graded homework). Move the streak update out of page-load and into `awardXp`/verified-activity hooks.
- **Technical approach:** `recordLearningDay(studentId)` called from verified-activity paths; dashboard load only *reads* the streak.
- **Migration:** Deploy alongside; existing streaks preserved.
- **Expected improvement:** Streaks mean consistent *learning*.
- **Priority:** High.

### 1.5 Writing band is heuristic and gameable — High
- **Current behavior:** Mock/heuristic writing band comes from `heuristicWritingAssessmentSafe` (word count, sentence length, lexical diversity). `isGenuineWriting` only blocks blank/too-short/repeated text.
- **Problem:** A long, varied, **off-topic** essay scores well and earns XP; no topic-relevance or coherence check. GPT path is better but the fallback is exploitable.
- **Risk:** **High.**
- **Recommended redesign:** Always score writing with the AI examiner when available; when not, cap heuristic-derived band (e.g. ≤ 6.0) and mark it "provisional". Add topic-relevance (embedding similarity to the prompt) as an effort/anti-cheat signal.
- **Technical approach:** Relevance score = cosine similarity(prompt, essay) via embeddings; gate XP on relevance + `isGenuineWriting`.
- **Migration:** Additive; provisional flag shown only in data, not UI.
- **Expected improvement:** Writing XP reflects real writing.
- **Priority:** High.

### 1.6 `updateRankings()` doesn't scale — High
- **Current behavior:** On every points change it loads **all** students and issues an `UPDATE` per student for `globalRank` (and again per group).
- **Problem:** O(N) writes per XP event; at thousands of students this is a write storm and a latency/lock problem.
- **Risk:** **High (scalability).**
- **Recommended redesign:** Compute rank **on read** (windowed SQL `RANK() OVER (ORDER BY totalPoints DESC)`) or recompute in a debounced background job (e.g. every few minutes / on cron), not synchronously per award.
- **Technical approach:** Replace synchronous loop with a SQL view / `$queryRaw` rank on the leaderboard query; drop the per-award recompute.
- **Migration:** Keep the `globalRank` column as a periodically-refreshed cache; switch reads to computed rank first.
- **Expected improvement:** XP writes become O(1); scales to 100k+ students.
- **Priority:** High.

### 1.7 Spaced repetition is client-only and disconnected — High (opportunity)
- **Current behavior:** `lib/srs.ts` is a solid SM-2 engine, but state lives in `localStorage` (`averna_srs_v1`) used only by flashcards + Mistake Bank. No server sync, no XP, no AI awareness.
- **Problem:** Retention (the highest-value learning signal) is invisible to the platform, lost on device change, and can't drive review reminders or mastery.
- **Risk:** **High (missed value).**
- **Recommended redesign:** Promote SRS to a **server-backed review ledger** that (a) syncs across devices, (b) feeds XP (reviews earn retention-XP), (c) feeds the AI ("3 grammar items are due / fading"), (d) drives the daily plan.
- **Technical approach:** New `ReviewItem` table (studentId, itemKey, ease, interval, due, reps, lapses); keep `lib/srs.ts` math, swap persistence to the DB; client reads/writes via a thin API.
- **Migration:** One-time import of localStorage state on first load; dual-write during transition.
- **Expected improvement:** Retention becomes a first-class, rewarded, AI-visible signal.
- **Priority:** High.

### 1.8 No lesson lifecycle / mastery evidence — High
- **Current behavior:** "Mastery" ≈ average band (`getGalaxy`, `getMemoryTimeline`). There's no Started→Learning→Practicing→Verified→Mastered→Retained progression; a single lucky test can imply mastery.
- **Problem:** Mastery isn't evidence-based or confirmed over time.
- **Risk:** **High.**
- **Recommended redesign:** A **Learning Verification Engine** (Step 5): each skill/topic advances stages only with repeated, spaced, genuine evidence; "Mastered" requires ≥N correct at target difficulty across ≥M sessions on different days; "Retained" requires a passed delayed review.
- **Technical approach:** `SkillState` table (studentId, skill, stage, evidenceCount, lastVerifiedAt, decayAt); derive stage from tests + SRS reviews.
- **Migration:** Backfill stages from existing test history; surface in existing Galaxy/Skill widgets (same UI, truer numbers).
- **Priority:** High.

### 1.9 Client-side mini-games = engagement, not verified learning — Medium
- **Current behavior:** Ghost Race, Boss Battle, Focus Vault, Word Duel, Confidence Meter, Daily Spin are fully client-side (localStorage); their "records" are per-device and unverifiable; they don't grant server XP (good for integrity, but also disconnected).
- **Problem:** They create a *feeling* of progress with no verified learning and no cross-device truth.
- **Risk:** **Medium.**
- **Recommended redesign:** Keep the fun UI; where a game genuinely tests recall (Word Duel, Confidence Meter, Boss Battle use real vocab/mistakes), route their results through the verification engine so *correct recall* earns small retention-XP and feeds SRS — while purely-timer games (Focus Vault) stay cosmetic.
- **Priority:** Medium.

### 1.10 AI recommendations not always evidence-linked — Medium
- **Current behavior:** `averna-ai` is grounded in `getExamReadiness` + `getMemoryTimeline` (good); `mission-control` is rule-based with an optional GPT deepening. But some outputs read as generic and don't always cite the datum behind them; there's a template fallback with no key.
- **Problem:** Recommendations that don't show "why" erode trust and can be wrong.
- **Risk:** **Medium.**
- **Recommended redesign (Step 6):** Every recommendation carries an `evidence` object (the metric + value it's based on) and renders "because …" text; `predictBand`'s weighted average is fine as v1 but should be labelled *estimate* and upgraded toward an ability model as data grows.
- **Priority:** Medium.

### 1.11 Misc integrity/data items — Medium/Low
- Client-supplied `timeSpent` is stored and used in analytics — unreliable (**Low**; clamp to plausible bounds server-side).
- Point awards aren't idempotent — a retried request can double-award (**Medium**; attach an idempotency key per submission).
- Reading allows unlimited identical retakes with the same `testId` (**High**, folded into 1.3 — count only first attempt for XP; later attempts earn "review" XP only).

---

## STEP 2 — Core educational engine (per module)

For each module: *what counts as learning · how mastery is verified · how forgetting is measured · when review is required · when XP is earned · when rewards are blocked · when AI intervenes.*

- **Reading / Listening:** Learning = correct answers on **server-validated** items. Mastery = sustained accuracy at target difficulty across ≥3 sessions on different days. Forgetting = time since last verified item of that question-type (feeds SRS). Review required when a type's retention estimate drops < 70%. XP on first genuine attempt (scaled by difficulty + improvement); repeats earn review-XP only. Blocked when effort gate fails (0 answered / random). AI intervenes when a question-type keeps failing.
- **Writing:** Learning = AI-examined essay meeting relevance + genuineness. Mastery = repeated band at/above target on distinct prompts. XP scaled by band **delta** vs the student's recent writing average (rewards improvement). Blocked on off-topic/low-effort. AI intervenes with the top recurring error (article/tense/cohesion).
- **Speaking:** Learning = completed speaking turn with a transcript that addresses the prompt. Mastery = fluency/relevance trend. XP for genuine responses (length + relevance), not mere room-join. Blocked on empty/near-silent turns.
- **Grammar / Vocabulary:** Learning = correct **recall** in SRS reviews (not first-see). Mastery = interval ≥ 21 days with reps ≥ 4. Forgetting = SRS `due`. Review required when due. XP = retention-XP on successful due reviews (bonus for longer intervals). Blocked on button-mashing (answer faster than readable → discounted).

---

## STEP 3 — Anti-cheat architecture

A single `assessEffort(submission)` gate feeding a `trustScore` (0–1) that scales rewards (never hard-blocks learning):

- **Random/guessing:** accuracy ≈ chance across many items, or answer entropy patterns → trust ↓.
- **Too-fast:** time-per-item below a human floor → trust ↓ (server-clamped time, not client `timeSpent`).
- **Copied/low-effort writing:** `isGenuineWriting` + prompt-relevance (embeddings) + optional n-gram overlap with the prompt/source.
- **Score inflation:** only server-computed scores exist (Step 1) → inflation impossible for reading/listening.
- **Farming (XP/coins/rewards):** repeat-content decay + daily XP soft cap with diminishing returns + first-attempt-only base XP.
- **Transparency:** when rewards are reduced, tell the student *why* ("Bu urinish uchun XP kamaytirildi — javoblar tasodifiy koʻrindi") and recommend the real next step. No silent penalties.

---

## STEP 4 — XP Engine 2.0 (single formula, all modules)

One authority: `awardXp(studentId, source, ctx)`.

```
baseXP      = difficulty × masterySignal
difficulty  = 0.6 + 0.4 × (bandTarget / 9)          // harder content pays more
masterySignal = clamp(correctness or band/9, 0..1)
improvement = max(0, current − recentAverage) × K    // rewards growth
repeatDecay = 1 / (1 + timesSeenThisContent)         // kills farming
trust       = assessEffort(...)                       // 0..1 anti-cheat
retentionXP = onlyForDueSrsReviews × intervalBonus    // rewards remembering
XP = round( (baseXP + improvement) × repeatDecay × trust ) + retentionXP
```
Plus a **daily soft cap** with diminishing returns beyond it, and a **consistency multiplier** tied to the *verified* streak (Step 1.4). XP is monotonic (never retroactively removed).

---

## STEP 5 — Learning Verification Engine (stages)

`Started → Learning → Practicing → Verified → Mastered → Retained`, stored in a `SkillState` table.

- Advance only on **evidence**: correct, genuine, server-validated attempts.
- **Verified** = passed at target difficulty at least once with good effort.
- **Mastered** = ≥N verified attempts across ≥M *different days*.
- **Retained** = passed a **delayed** review (SRS) after the mastery date.
- Decay: if no successful review before `decayAt`, drop Retained→Mastered→Practicing and resurface for review. This is what the existing Galaxy/Memory-Timeline UIs *should* be reading.

---

## STEP 6 — AI decision engine

- Every recommendation ships with `evidence: { metric, value, threshold }` and renders a "because …" line.
- Inputs unified into one `StudentModel` (history, mistakes, learning speed, confidence calibration from Confidence Meter, weak/strong skills, SRS decay, active hours) — most already computed in `lib/student-intel.ts` and the mini-games; connect them.
- `predictBand` v1 (weighted average) kept but labelled *estimate*; roadmap to a simple ability/IRT-style model once ≥8 data points per skill exist (confidence already tracks sample size).
- Remove any generic fallback text that isn't backed by a datum; if there's no data, say "not enough data yet" instead of inventing advice.

---

## STEP 7 — Teacher intelligence (same UI, better logic)

Recompute the existing teacher panels on **outcomes** instead of counts:
- "At-risk" = predicted-band trend down **and** SRS decay rising **and** activity gap — not just "inactive".
- Surface each student's **top recurring error type** (from mistakes/writing analysis) so the teacher fixes causes, not symptoms.
- Grading queue prioritised by learning impact (blocking a struggling student) not FIFO.

## STEP 8 — Admin intelligence (replace vanity metrics)

Behind the current Mission Control cards, swap "tests today / new signups" for: **verified-learning rate** (share of activity that passes the effort gate), **retention** (returning + SRS-due-completed), **mastery velocity** (stages advanced/week), **teacher effectiveness** (students' band delta per teacher), **at-risk cohort size**, **integrity flags** (farming/guessing detected). Same layout, meaningful numbers.

## STEP 9 — System connections (one ecosystem)

`Verified activity → SkillState + SRS → XP 2.0 → level/achievements → motivation model → AI plan → daily review/practice → verification …` Everything flows through two authorities: **`awardXp`** and the **verification engine**. No system writes points or "mastery" directly anymore.

---

## STEP 10 — Implementation roadmap (each phase deployable, UI unchanged)

**Phase 1 — Integrity & scale (highest impact, low risk).**
1. Server-side listening/mock scoring from raw answers (fix 1.1). ← start here
2. Tighten reading string matching (1.2).
3. Replace synchronous `updateRankings` with computed/debounced rank (1.6).
4. Idempotent point awards + server-clamped `timeSpent` (1.11).

**Phase 2 — XP Engine 2.0 + verified streak.**
5. Central `awardXp`; route all award sites through it; repeat-decay + daily cap (1.3).
6. Move streak to verified-learning events (1.4).

**Phase 3 — Verification & retention.**
7. Server-backed SRS ledger + import from localStorage (1.7).
8. `SkillState` lifecycle powering existing Galaxy/Memory UIs (1.8).
9. Writing relevance/effort gate (1.5); connect recall mini-games (1.9).

**Phase 4 — AI upgrades.**
10. `StudentModel` unification + evidence-linked recommendations (1.10 / Step 6).
11. Teacher/Admin metric swap (Steps 7–8).

**Phase 5 — Optimization.**
12. Caching, background jobs, load tests at 100k students, dashboards for integrity flags.

Each phase is independently shippable and never changes a screen the user already knows.

---

## What I recommend doing first
**Phase 1, item 1 (the listening/mock client-trust fix)** is a true Critical and a small, self-contained change — it makes every downstream band, level and ranking trustworthy. It's the natural first commit.
