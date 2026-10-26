# Peer speaking (1-on-1 between students)

The contract for the three phases. **Phase A** (done): hub, smart matching, session
state machine, data model. **Phase B** (done, §7): the room UI on the session API (voice
call, phases, timers, prompts, live helpers), XP. **Phase C** (done, §8): give-to-get peer
feedback + next step, report/block, fair XP, signal cleanup, opt-in AI coach, teacher
monitor, hub progress card.

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
- Teachers/admins: the hub without matching + a link to `/teacher/speaking` (the monitor,
  §8). Parents: the hub without matching. Students also get "Your peer speaking" (§8).

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
durationSec, endedAt, endedBy, levels: {A,B}, content, timedMs?, xpHold? }` (times in
epoch ms; `timedMs`/`xpHold` since Phase C, §8 — older states count `timedMs` as 0).

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
  me: { seat, firstName, level }, partner: { seat, firstName, level }, xp, xpHold }`
  (`state` is null for rooms made before formats existed; `xp` = the caller's award once
  the session finished naturally, else null; `xpHold` = why no XP once done, §8).
  Shape: `lib/speaking/session-view.ts`.
- `POST { action, version }` (same-origin) → `{ state, version, changed, xp? }`;
  409 `{ error, state, version }` when `version` is stale, another write won, or the room
  ended; 400 on a bad body. Reaching done sets the room ENDED and deletes both queue rows;
  a natural finish (`endedBy: null`) also awards XP to both students (§7) and returns the
  caller's amount as `xp`.

## 5. Data model (schema.prisma + additive `prisma/sql/deploy.sql`)

- `SpeakingQueue` + `format`, `level`, `groupId`, `lastSeenAt` (`createdAt` = join time).
- `SpeakingRoom` + `format`, `state` (Json), `version`, `level`; indexes on (studentAId|studentBId, createdAt).
- `SpeakingPeerFeedback` (roomId, fromStudentId, toStudentId, fluency/lexical/grammar/
  pronunciation 1–5, strength?, tip?; unique roomId+fromStudentId). `strength` = a strength
  preset id; `tip` = `"<tipId>"`, `"<tipId>|<note>"` or `"|<note>"` (the free-text line;
  `packTip`/`unpackTip` in `lib/speaking/feedback-presets.ts`) — no schema change.
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
"Session complete" / "Session ended by {name}", duration, "+N XP" (or why not, §8), peer
feedback, the AI coach offer (§8). Always: "End
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
Phase C adds the fair-XP rules (§8).

**Removed:** the room's text chat, emoji bar and push-to-talk, `/api/speaking/room`
(GET/POST/DELETE — the hub leaves the queue with `/api/speaking/match` DELETE, the room
ends with the session `end`), and `components/speaking/voice-call.tsx`. The
`SpeakingMessage` table stays (old data). The solo runner is unchanged.

## 8. Phase C — feedback, safety, fair XP, AI coach, teacher monitor

All new student endpoints are members-of-the-room only (`lib/speaking/room-member.ts`:
401 / 400 bad id / 404 / 403), `Cache-Control: private, no-store`; POSTs are same-origin
(`trustedMutation`) with `boundedJson`.

**Peer feedback — "give to get"** (`/api/speaking/feedback`, `components/speaking/peer-feedback.tsx`).
- `POST { roomId, fluency, lexical, grammar, pronunciation (1–5 ints), strength?, tip?, note? }`
  — about the partner, once per room (unique roomId+fromStudentId → 409), only for an ENDED
  room whose first timed phase was reached (`feedbackAllowed`: a natural finish, or
  `timedMs > 0` before an early end; else 409). `strength`/`tip` must be preset ids
  (`lib/speaking/feedback-presets.ts`: 8 strengths, 10 tips, each mapped to a criterion);
  `note` is one free-text line, whitespace-collapsed, ≤ 140 chars, rejected (400) when it
  looks like a link, domain, e-mail, @handle or phone number (`hasContactInfo`).
- `GET ?roomId=` → `{ allowed, mine, received }`: `received` is the partner's feedback for
  me only after I sent mine (null while they haven't), else `{ locked: true, partnerSubmitted }`.
- Done screen: four accessible 1–5 star radio groups (native radios, descriptors per level),
  strength/tip chips (`aria-pressed`), the note, Send (enabled once all four are rated).
  After sending, the partner's feedback is revealed; while waiting the client polls every
  5 s for up to 2 min. "Your next step" (`lib/speaking/next-step.ts#nextStepFor`): the
  weakest received criterion (ties: fluency, lexical, grammar, pronunciation); own caption
  stats (≥ 30 words; fillers > 5% of words or < 100 wpm) lower fluency by 1 →
  pronunciation `/learning/pronunciation`, lexical `/flashcards`, grammar `/grammar`,
  fluency `/learning/speaking/solo`. Without partner ratings (after the wait) only own stats.

**Report & block** (`components/speaking/peer-safety-menu.tsx`, in the room header — any
time, also on the done screen). The dialog says: blocked students are never matched again
(blocking also ends this session); reports go to teachers; two open reports pause a
student's peer speaking.
- `POST /api/speaking/report { roomId, reason ∈ inappropriate|harassment|not-speaking-english|no-show|other, note? ≤ 300 }`
  — one OPEN report per reporter per room (409), 5 per day per student (`reserveLimits`
  `speaking-report:<id>`, 429/503). The partner is the reported student.
- `POST /api/speaking/block { roomId }` — upserts `SpeakingBlock(blocker = me, blocked =
  partner)`; matching honours it both ways. An ACTIVE room ends via the state machine
  (`end` by the blocker, `lib/speaking/room-end.ts#endRoomBy`, versioned write with one
  retry) → `{ ok, state, version }`, so the blocker's client adopts done and the partner's
  next poll shows it.

**Fair XP** (`lib/speaking/xp-rules.ts`, pure; DB reads in `peer-xp.ts#peerXpHolds`). The
finishing POST pays a seat only when (a) `state.timedMs ≥ 50%` of `plannedTimedMs(state)`
(sum of timed durations; conversation: one timer per card) — the state machine banks
`now − startAt` whenever a timer stops (next card, next phase, skip, end), each stretch
capped at its timer × 1.5; (b) the student has no peer award today (Tashkent) from a room
with the same partner; (c) fewer than 3 peer awards today. Awards are counted from the
`SPEAKING_SESSION_COMPLETED` logs with `details.kind = "peer"` (the room itself excluded).
The decision is written with the done state as `state.xpHold { A?, B? }`
(`"unfinished" | "pair" | "daily"`); a rules read error pays nothing. The done screen shows
"Finish both rounds to earn XP" (early end or < 50%) / "XP is limited to one session per
partner per day" / "Daily peer-speaking XP limit reached".

**Signal cleanup.** The done transition (session POST or block) deletes the room's queue
rows and `SpeakingSignal` rows (best effort). The daily cron (`/api/cron/daily`, job
`peer-speaking-cleanup`, once per Tashkent day) deletes signals and queue rows older than
a day.

**AI coach** (`/api/speaking/coach`, `components/speaking/peer-coach.tsx`, `lib/ai.ts#coachPeerSpeaking`).
Offered on the done screen only when `hasOpenAI()` and the student turned captions on
(≥ 25 caption words). Consent text: "Your captions transcript (your words only) is sent to
our AI provider to give feedback. Nothing of your partner is sent." + a checkbox.
`POST { roomId, consent: true, transcript ≤ 6000 chars, stats: { words, wpm, fillers } }` —
consent required (400), members only, `guardAi(userId, "peer-coach")` = 3 per hour/day
per student plus the platform ceiling (429). gpt-4o with a strict JSON schema →
`{ bandEstimate: { low, high } (≤ 1.0 apart, shown as "Estimated band 5.5–6.0", an
estimate), strengths[2], improvements[3] { point, original, rewrite }, vocabularyUpgrades[3]
{ instead, try } }` (`parsePeerCoach` validates); failure → 502 with a friendly message.
The transcript is never stored, and logs carry only error names.

**Teacher monitor** `/teacher/speaking` (TEACHER + ADMIN; English, shared with admins).
Scope: `visibleStudentIds` — a teacher's group students, admins all
(`lib/speaking/teacher-monitor.ts`). Summary (sessions this week, unique students, average
session length, students paused); open reports (reason, note, reporter → reported with
first names + groups, paused badge, "Resolve" + "Resolving unpauses {name}…" when it drops
the open count below `PAUSE_REPORTS`); this week's sessions (Tashkent week: date, both
first names + groups, format, length, Completed / Ended early / In progress, average peer
rating each way). `POST /api/teacher/speaking/reports/[id]/resolve` — same-origin, role
check, teachers only when the reporter or reported student is in their groups (403), sets
RESOLVED, resolvedAt, resolvedById (user id) → `{ ok, stillPaused }`. Teacher nav: "Peer
Speaking" under Students.

**Hub progress card** (students, `components/speaking/peer-progress-card.tsx`,
`lib/speaking/peer-progress.ts`): sessions this week, different partners this calendar
month, average received rating per criterion over the last 10 feedbacks with a trend
(newest half vs the half before, ±0.3), and the current next step; an empty state before
the first session.

**Still open:** `usePeerVoice`'s data channel is unused; reports have no unique index, so
two simultaneous reports from the same student for one room could both land (the 5/day
limit bounds it).
