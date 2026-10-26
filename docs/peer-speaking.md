# Peer speaking (1-on-1 between students)

The contract for the three phases. **Phase A** (done): hub, smart matching, session
state machine, data model. **Phase B**: the room UI on the session API (voice call,
phases, timers, prompts), XP. **Phase C**: peer feedback, report/block, teacher monitor.

## What it replaces

Before commit 7103f2a, `/learning/speaking` was `components/learning/speaking-runner.tsx`:
solo Part 1/2/3 practice plus a "Find a Partner" button. The old `/api/speaking/match`
paired the two oldest waiting students (FIFO, no level, no format, no heartbeat; a
`PENDING` claim that could get stuck). Rooms at `/learning/speaking/room/[roomId]` had
text chat (`/api/speaking/room`) and WebRTC voice (`components/speaking/voice-call.tsx`,
signalled through `/api/speaking/signal`). **There was no time-window rule**: the page
showed the Speaking Time schedule (19:00–21:00 Tashkent, `isSpeakingTime()`) but said
"you can practise pairing any time". The new flow keeps that: matching is always open;
Speaking Time only shows a "Speaking Time is live" badge.

## 1. Hub — `/learning/speaking`

- Students: hero "Speak with a partner" (`components/speaking/peer-hub.tsx`) — live
  presence ("N students looking right now" = fresh unmatched queue rows), Speaking Time
  badge, detected level ("Matched around Band 6.0 / B2"), format picker, mic check
  (`components/speaking/mic-check.tsx`: permission state + level meter, releases the mic
  after 15 s, works before matching), "Find a partner". Paused students see the paused
  message and can't join. "Find a partner" is disabled when the mic is blocked/missing.
- Secondary cards: Practise alone (`/learning/speaking/solo`, the old runner without its
  match UI; uses published sets, else the peer bank's questions without sample answers),
  AI Examiner (`/learning/examiner`), Full Speaking test (`/learning/speaking-test`, which
  still renders `TeacherSpeakingPractice`).
- Teachers/admins: the hub without matching + a link to `/teacher/speaking` (placeholder
  until Phase C). Parents: the hub without matching.

## 2. Formats

| format | flow (per round; round 2 swaps roles) | durations |
|---|---|---|
| `exam` | examiner + candidate: Part 1 → Part 2 prep → Part 2 talk → Part 3 | 240 / 60 / 120 / 240 s |
| `quick` | examiner + candidate: Part 2 prep → talk → 1 follow-up | 60 / 120 / 45 s |
| `conversation` | the round's lead answers prompt cards first; new card on Next or every 2 min | 120 s per card, 3 cards |
| `debate` | one motion: opening FOR → opening AGAINST → rebuttal FOR → rebuttal AGAINST; round 2 swaps sides | 120 / 120 / 60 / 60 s |

Labels: `lib/speaking/formats.ts`.

## 3. Level and matching

**Level** (`lib/speaking/level.ts`, DB read in `lib/speaking/peer-store.ts#studentPeerLevel`),
first available of: latest IELTS Speaking test score (`IELTSTest` module SPEAKING, last
365 days) → latest finished placement band (`PlacementAttempt.band`) → `Student.level`
text (band number, or CEFR code → A2 3.5, B1 4.5, B2 6.0, C1 7.5, C2 8.5) →
`Student.targetBand − 1.0` → 5.0. Clamped to 3.0–9.0, rounded to 0.5. CEFR label:
<4 A2, <5.5 B1, <7 B2, <8.5 C1, else C2. Stored on the queue row at join.

**`pickPartner(me, candidates, ctx, now)`** (`lib/speaking/matching.ts`, pure):
only fresh rows (lastSeen ≤ 15 s), same format, not self, not blocked (either
direction); level gap ≤ `0.5 + 0.5 × floor(olderWait / 20 s)`; recent partners (last 3
sessions of either student, last 30 days) only if nobody else qualifies; score =
gap − 0.25 × min(partnerWait, 120 s)/120 s − 0.25 if a different group; lowest score
wins, ties by joinedAt then id.

**`/api/speaking/match`** (students only; others 403; `Cache-Control: private, no-store`):

- `POST { format }` — same-origin only; 6 per minute per student (429/503); paused → 403
  `{ error, code: "paused" }`. Upserts the queue row (first name, level, groupId,
  lastSeenAt; re-joining the same format keeps the place), then a match attempt.
- `GET` — heartbeat (`lastSeenAt = now`) + match attempt. The client polls every 3 s
  only while the tab is visible (15 s presence refresh when idle).
- `DELETE` — leave (only an unmatched row). The hub also sends it on `pagehide`.

Responses: `{ status: "idle", lookingNow, byFormat }` ·
`{ status: "waiting", format, level, waitingSec, lookingNow, byFormat, suggestAlternatives }`
(`suggestAlternatives` after 60 s) · `{ status: "matched", roomId }` (only for an ACTIVE room).

Each match call first deletes unmatched rows silent for > 60 s and any row silent for
> 30 min. Claim: one transaction updates both rows `where { id, roomId: null, format }`
(partner also `lastSeenAt ≥ now − 15 s`) in id order (no deadlocks) to a pre-generated
room id and creates the room; any lost claim rolls back and the caller stays waiting
(or learns it was matched). Room: A = the longer waiter, `starter` random, `level` =
pair average, `state` = `initialSessionState(buildPeerContent(format, level), …)`, `version` 0.

**Content** (`lib/speaking/peer-content.ts`): `SPEAKING_SEED` (exam: two different sets,
Part 1 2–3 topics × 3 questions, Part 3 first 3 / first 4 / last 4 questions for
<5 / <7 / ≥7; quick: two cue cards + follow-up), conversation cards (<5 seed Part 1
questions, <7 `SPEAKING_TOPICS`, ≥7 seed Part 3), debate motions by tier (<5 easy,
<7 mid, else hard). Stored with ids in `state.content`.

## 4. Session state machine and API

`lib/speaking/session.ts` (pure, client-safe). `phasePlan(state)`:
`lobby → round-0 timed phases → swap → round-1 timed phases → done`. Each timed
`PhaseSpec` has `key`, `round`, `lead` (may advance), `speaker`, `durationSec`,
`prompts`, `timerPerPrompt`, `side` (debate).

State (`room.state`): `{ v: 1, format, starter, phase, prompt, ready: {A,B}, startAt,
durationSec, endedAt, endedBy, levels: {A,B}, content }` (times in epoch ms).

`advance(state, action, by, now)` — invalid actions return the same object:

- `ready` — lobby only, sets `ready[by]`.
- `start` — lobby (both ready) or swap; only `advancer(state)` (the next phase's lead).
- `next` — timed phase, lead only: next prompt (conversation restarts the timer), after
  the last prompt the next phase.
- `skip` — timed phase, lead only: straight to the next phase.
- `end` — either seat, any time before done: to done, `endedBy` set. A natural finish
  sets `endedBy: null`.
- Entering a timed phase sets `startAt = now`, `durationSec`. The UI shows time left as
  `startAt + durationSec·1000 − (serverNow-corrected) now`; when it hits 0 the **lead's**
  client sends `next` (nobody else can).

`applyVersioned` bumps `version` only when the state changed.

**`/api/speaking/session/[roomId]`** (members only: 401/403/404; id `^[A-Za-z0-9_-]{1,64}$`):

- `GET` → `{ roomId, status, format, topic, state | null, version, serverNow,
  me: { seat, firstName, level }, partner: { seat, firstName, level } }`
  (`state` is null for rooms made before formats existed).
- `POST { action, version }` (same-origin) → `{ state, version, changed }`;
  409 `{ error, state, version }` when `version` is stale, another write won, or the room
  ended; 400 on a bad body. Reaching done sets the room ENDED and deletes both queue rows.

## 5. Data model (schema.prisma + additive `prisma/sql/deploy.sql`)

- `SpeakingQueue` + `format`, `level`, `groupId`, `lastSeenAt` (`createdAt` = join time).
- `SpeakingRoom` + `format`, `state` (Json), `version`, `level`; indexes on (studentAId|studentBId, createdAt).
- `SpeakingPeerFeedback` (roomId, fromStudentId, toStudentId, fluency/lexical/grammar/
  pronunciation 1–5, strength?, tip?; unique roomId+fromStudentId).
- `SpeakingBlock` (blockerId, blockedId; unique pair) — honoured both ways by matching.
- `SpeakingReport` (roomId, reporterId, reportedId, reason, note?, status OPEN|RESOLVED,
  resolvedAt?, resolvedById?). `PAUSE_REPORTS = 2` OPEN reports pause the reported student.

## 6. Safety baseline

Students only queue/join; room, signal and session APIs check membership (room DELETE
too, since Phase A); voice only; only first names + level are shown; nothing is
recorded (said in the UI).

## Notes for Phase B

- Rebuild `/learning/speaking/room/[roomId]` on the session API; keep `VoiceCall`
  (`isInitiator` = seat A). Drop the text chat and push-to-talk messages (voice only);
  `/api/speaking/room` GET/POST can then go.
- Lobby: each partner runs the mic check, then sends `ready`; `advancer(state)` sees
  "Start". Poll GET every 2–3 s while visible; on 409 refetch.
- XP: on natural completion award `SPEAKING_SESSION_COMPLETED` (in `BUDGETED_ACTIONS`,
  lib/engine/xp-engine.ts) to both students via `awardXp` with
  `idempotencyKey: "peer-speaking:<roomId>:<studentId>"`; not for `end` before round 2.
- Partner never shows up: the lobby should offer "Leave" (`end`) after ~60 s.

## Notes for Phase C

- `POST` feedback/report/block endpoints (students in the room only; one feedback per
  room per student). A block also ends any shared ACTIVE room.
- Teacher monitor `/teacher/speaking`: sessions of the teacher's groups (room ↔ students
  ↔ `Student.groupId`), open reports, resolve (sets RESOLVED, resolvedAt, resolvedById).
  Admin-only views must be in Uzbek (.kiro/steering/admin-language.md).
