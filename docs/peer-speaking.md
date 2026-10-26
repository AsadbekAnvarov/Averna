# Peer speaking (1-on-1 between students)

The contract for the three phases. **Phase A** (done): hub, smart matching, session
state machine, data model. **Phase B** (done, §7): the room UI on the session API (voice
call, phases, timers, prompts, live helpers), XP. **Phase C**: peer feedback, report/block,
teacher monitor.

## What it replaces

Before commit 7103f2a, `/learning/speaking` was `components/learning/speaking-runner.tsx`:
solo Part 1/2/3 practice plus a "Find a Partner" button. The old `/api/speaking/match`
paired the two oldest waiting students (FIFO, no level, no format, no heartbeat; a
`PENDING` claim that could get stuck). Rooms at `/learning/speaking/room/[roomId]` had
text chat (`/api/speaking/room`, removed in Phase B) and WebRTC voice (`components/speaking/voice-call.tsx`,
now the `usePeerVoice` hook; signalled through `/api/speaking/signal`). **There was no time-window rule**: the page
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

- `GET` → `{ roomId, status, format, topic, state | null, version, serverNow, createdAt,
  me: { seat, firstName, level }, partner: { seat, firstName, level }, xp }`
  (`state` is null for rooms made before formats existed; `xp` = the caller's award once
  the session finished naturally, else null). Shape: `lib/speaking/session-view.ts`.
- `POST { action, version }` (same-origin) → `{ state, version, changed, xp? }`;
  409 `{ error, state, version }` when `version` is stale, another write won, or the room
  ended; 400 on a bad body. Reaching done sets the room ENDED and deletes both queue rows;
  a natural finish (`endedBy: null`) also awards XP to both students (§7) and returns the
  caller's amount as `xp`.

## 5. Data model (schema.prisma + additive `prisma/sql/deploy.sql`)

- `SpeakingQueue` + `format`, `level`, `groupId`, `lastSeenAt` (`createdAt` = join time).
- `SpeakingRoom` + `format`, `state` (Json), `version`, `level`; indexes on (studentAId|studentBId, createdAt).
- `SpeakingPeerFeedback` (roomId, fromStudentId, toStudentId, fluency/lexical/grammar/
  pronunciation 1–5, strength?, tip?; unique roomId+fromStudentId).
- `SpeakingBlock` (blockerId, blockedId; unique pair) — honoured both ways by matching.
- `SpeakingReport` (roomId, reporterId, reportedId, reason, note?, status OPEN|RESOLVED,
  resolvedAt?, resolvedById?). `PAUSE_REPORTS = 2` OPEN reports pause the reported student.

## 6. Safety baseline

Students only queue/join; the room page, signal and session APIs check membership; voice only; only first names + level are shown; nothing is
recorded (said in the UI).

## 7. Phase B — the room (`/learning/speaking/room/[roomId]`)

**Page** (server): signed-in students who are a member of the room only (teachers,
parents, other students, bad ids and pre-format rooms get a friendly notice). Renders
`components/speaking/peer-room.tsx` with the first `SessionView`.

**Sync.** GET every **2 s** while the tab is visible (skipped when hidden; immediate fetch
on `visibilitychange`), stopped once done. Actions POST with the current `version`; the
reply (or a 409's `state`/`version`) is adopted, a 409 also triggers one refetch. Older
versions from a slow GET are ignored. Clock: `offset = serverNow − request midpoint`;
time left = `startAt + durationSec·1000 − (Date.now() + offset)`. When the **lead's** timer
reaches 0 their client sends one action per state version (`lib/speaking/room-timer.ts
#timeUpAction`): `next` for conversation cards and on a phase's last prompt, `skip` while a
shared-timer part (Part 1 / Part 3) still has questions — time is up for the whole part.
The other partner sees "Time is up — waiting for {lead}…".

**Voice** (`components/speaking/use-peer-voice.ts`, the old `VoiceCall` as a hook):
seat A offers, seat B answers, signalled through `/api/speaking/signal` with per-attempt
`sid` + ICE-restart `gen` (stale signals ignored); B sends `hello` on (re)join. Signal
polling: **1 s** while connecting/reconnecting, **5 s** after giving up (to notice the
partner's Reconnect), **none** while connected (a closed data channel or `disconnected`
resumes it). On `failed` or no connection within 25 s: one automatic ICE restart (B asks A
with `restart`), then a "Reconnect" button. The mic is released on done, unmount and
`pagehide`. ICE servers come from `/api/speaking/capabilities` → `iceServers`
(`lib/speaking/ice.ts`): public STUN, plus TURN for students when `TURN_URLS`
(comma-separated `turn:`/`turns:`), `TURN_USERNAME` and `TURN_CREDENTIAL` are all set.
**Without TURN ~10–20% of mobile/CGNAT calls can fail; set TURN to fix.** The TURN
credential is visible to signed-in students' browsers (WebRTC needs it): use a dedicated
user with bandwidth limits (or short-lived credentials later).

**Screens** (role-aware, from `currentPhase(state)` + `state.content`): lobby (mic check on
the call's own stream, the partner's voice meter, ready per seat, "Start" for
`advancer(state)`, "Leave" (= `end`) after 60 s with the partner not ready); exam/quick —
the examiner gets the script (questions with "Next question", "Say: …" lines, cue card,
follow-up, "Thank you, that's the end of Part N" on the last question or ≤ 20 s), the
candidate only the cue card in Part 2 (with private notes) and "Listen to your examiner"
otherwise; conversation — the card for both, "Next card" for the lead; debate — motion,
side, whose turn, "Finish my turn", private rebuttal notes for the listener; swap; done —
"Session complete" / "Session ended by {name}", duration, "+N XP", and
`components/speaking/peer-feedback-slot.tsx` (placeholder for Phase C). Always: "End
session" (confirm dialog), mute (≥ 44 px), connection pill, partner first name + level.
Timers are announced at 1 min / 30 s / 0 and on each new phase (aria-live).

**Live helpers** — client-side only, nothing recorded or uploaded by Averna:
- Talk-time balance (`lib/speaking/talk-time.ts`): a VAD (RMS ≥ 0.025, 400 ms hangover)
  on the own mic and on the partner's incoming stream, counted only in timed phases;
  "You 55% · Bek 45%" per round (exam/quick) or overall (conversation/debate). In
  conversation, > 70% of ≥ 45 s of talk in the last 2 minutes shows the dominant student
  "Invite {partner} in — ask a follow-up question".
- Phrase drawer (`lib/speaking/phrases.ts`): functional phrases by format/phase/role.
- Own-speech captions (opt-in, hidden when unsupported): Web Speech API, `en-GB`, own mic
  only, shown only to that student; words, words per minute (over own VAD speaking time)
  and fillers (`lib/speaking/fluency.ts`). Transcript in memory only. The UI says the
  browser's speech service may process audio online (Chrome does) and to turn captions
  off if the partner can't hear them on a phone.

**XP** (`lib/speaking/peer-xp.ts`): the POST that reaches done with `endedBy: null` awards
both students `XP_CONFIG.peerSpeaking[format]` (exam 60, quick 25, conversation 30,
debate 35) after the daily budget taper (`applyDailyBudget` over today's
`BUDGETED_ACTIONS` XP), via `awardXp` (source `test`, ActivityLog
`SPEAKING_SESSION_COMPLETED` written atomically with the ledger row) with
`idempotencyKey: "peer-speaking:<roomId>:<studentId>"`. `end` at any time earns nothing.

**Removed:** the room's text chat, emoji bar and push-to-talk, `/api/speaking/room`
(GET/POST/DELETE — the hub leaves the queue with `/api/speaking/match` DELETE, the room
ends with the session `end`), and `components/speaking/voice-call.tsx`. The
`SpeakingMessage` table stays (old data). The solo runner is unchanged.

## Notes for Phase C

- Replace `PeerFeedbackSlot` (props `roomId`, `partnerName`) on the done screen. The room
  knows both seats; the API knows the student ids. An opt-in AI summary of the student's
  own captions would need `hasOpenAI()` (lib/ai.ts) and an explicit consent step (the
  transcript currently never leaves the browser).
- `usePeerVoice` exposes a peer-to-peer data channel (`send`, `onMessage`) — unused so far.
- `SpeakingSignal` rows are never cleaned up; a cron or the done transition could delete
  a room's signals.
- `POST` feedback/report/block endpoints (students in the room only; one feedback per
  room per student). A block also ends any shared ACTIVE room.
- Teacher monitor `/teacher/speaking`: sessions of the teacher's groups (room ↔ students
  ↔ `Student.groupId`), open reports, resolve (sets RESOLVED, resolvedAt, resolvedById).
  Admin-only views must be in Uzbek (.kiro/steering/admin-language.md).
