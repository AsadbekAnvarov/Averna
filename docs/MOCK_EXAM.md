# Computer-delivered Mock Exam

## Scope and compatibility
New attempts store `papers.mode = cd-v1` in the existing MockAttempt JSON. They contain Listening → Reading → Writing as one uninterrupted sitting; Speaking uses the existing separate Speaking module. This is an Averna simulation, not an official IELTS delivery system. No schema migration, new audio generation, voice-provider request or new grading provider is introduced. Old attempts without this mode retain their four sections, breaks, original clocks and overall results.

## Existing content only
- Random selection prefers unseen existing papers. Listening must have four parts, exactly questions 1–40, and four ready HTTPS recordings whose script hashes match current content. Missing, stale, disabled or failed audio never causes CD mocks to return scripts or fall back to browser voices. The script endpoint independently refuses fallback for this mode.
- Reading's actual content must have three passages and exactly questions 1–40, not just a `full` library-card flag. Writing uses existing Task 1 and Task 2 prompts and the existing marking/review pipeline.
- Before the first clock starts, the candidate plays the beginning of the existing recording and confirms the headphone check. The client attempts playback when the running paper arrives. Browsers may still require an explicit Try again gesture; no promise of universal autoplay is made.

## Timing
- Listening clock = the four recording durations + two minutes for checking. Existing files already contain announcements/reading pauses; no additional 12-minute buffer is added.
- Listening playback and recovery are anchored to elapsed server time. Refresh/retry cannot restart the recording or grant a fresh answer-check window. A late join skips to the corresponding recording position. Audio outages consume exam time; the UI says so and provides retry, not a substitute voice.
- Reading and Writing each have 60 minutes. The next section starts at the earlier of the preceding deadline and submission receipt, so network/marking/page-load waits and closed tabs cannot create free breaks. A long absence may consume multiple sections; the server collects expired sections from account autosaves.
- All CD input freezes at the section deadline. The server accepts already-in-flight answers for at most **5 seconds** after that deadline (bounded transport grace, not extra working time). Beyond it, only the account draft counts. A slow save/expired sign-in/long offline period can exceed the cutoff: local backup alone does not guarantee those answers are graded.
- Unresolved draft conflicts at the deadline are collected from the account copy, not silently from the device copy. `fromDraft` collection requests before the deadline are rejected.

## Saving, versions and submissions
- Every change is copied into an attempt-and-section device envelope before network work; account saves are coalesced about four seconds and never overlap, including urgent hidden-tab/pagehide flushes. Keepalive is used only within browser body limits.
- The UI distinguishes confirmed account save, waiting, saving, failed save, device storage failure and revision conflict. Retry/online recovery are available; closing a failed save can still lose account delivery. Storage failures are reported rather than described as guaranteed backups.
- CD draft JSON holds a monotonic revision. Owner/current/status/updatedAt/deadline guards plus revision checks refuse stale writes. An identical lost-response replay acknowledges the stored revision. Local unacknowledged changes can restore even when the account contains nonempty answers; divergent revisions require a read-only comparison and deliberate choice. The comparison shows the remaining clock.
- Submission pauses saves and waits for the current request. CD submissions check the account revision before grading. Existing per-section idempotency keys preserve grading/XP retry semantics. Expired sections use the account draft. Once a section is confirmed, its device envelope is removed.
- Mutation APIs enforce trusted origins, current student role, blacklist, authenticated ownership, bounded JSON, strict section/draft shapes, shared limits and private/no-store responses. The run page also checks the live student role/blacklist before it can trigger server collection.

## Results and teacher review
New results/history contain three section bands and **no four-skill overall**, because Speaking is not part of that sitting. No fallback averages an absent Speaking score as zero. The teacher-review write path preserves null overall for CD attempts. Historical four-section results remain available. Separate Speaking is not automatically attached to the block or combined into an overall.

## Local QA and limits
- Unit tests cover versioned modes, bounded requests, ownership/live-role/blacklist/CSRF/limiter boundaries, missing/stale audio and the server script ban, acknowledged serial saving, lost-response replay, HTTP failures, device recovery/conflicts, deadlines, automatic next clocks, idempotent section replay and legacy compatibility.
- `scripts/verify-mock.cjs`: actual mock service with the existing SQL table on isolated PGlite; owner isolation, single-active index, competing CAS, stale timestamp guard, replay, expired collection, continuous next clock, three-section completion, null overall and FK cascade. This is not real multi-connection PostgreSQL certification.
- `e2e/mock-exam.cjs`: actual UI components/pages with synthetic account/content transport, real short WAV playback and no real user/provider. Phone/desktop, both themes, local drafts, offline/retry, compare, deadline, full Listening → Reading → Writing, elapsed-position recovery, failed audio and blocked-autoplay recovery, new/legacy results and hub history. Screenshots are reviewed individually. These mocks do not certify authenticated hosted routing, real grading latency, real CDN audio or physical browsers.
- TypeScript, zero-warning project ESLint, full Vitest suite and production Next build are checked before the commit. The pre-existing Auth.js/Jose Edge-runtime warning remains; hosted sign-in still needs staging acceptance. Workflow files/hosting settings are not changed; the standalone checks are not newly wired to CI.

## Release gates / rollback
Keep the PR draft until hosted deployment access, real authenticated two-tab/two-device PostgreSQL races, actual library/CDN playback, existing Writing-provider idempotency, teacher-review results, long suspended/offline tabs, server/client clock skew, physical Chrome/Edge/Safari, phone keyboards and keyboard/screen-reader acceptance are checked on isolated staging. No zero-defect or production-live claim is warranted by synthetic QA.

Roll back with a version-aware reader: stop new starts through an approved maintenance release, let active CD sittings finish or explicitly abandon with candidate consent, and retain their JSON/results. Do not blindly deploy a pre-CD reader over active CD attempts (their empty legacy Speaking key would be rejected). Do not rewrite old attempts or grades.
