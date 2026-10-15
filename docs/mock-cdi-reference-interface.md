# CDI Mock reference interface

The computer-delivered (`mode: cd-v1`) Listening → Reading → Writing sitting uses
an isolated presentation based on the supplied **Averna Full Mock** HTML.

## Scope

- `MockOrchestrator` enables `MockCdiProvider` only for `cd-v1`, keyed by attempt.
- `ExamShell` chooses the CDI presentation only when this context is present.
- Ordinary Reading/Listening/Writing practice, placement and legacy four-section
  mocks retain the existing Averna shell, colours and dictionary/highlight tools.
- No questions, answer keys, catalog order, source media, attempts, marking,
  database configuration or exam clocks were changed.

## Interface

White Arial paper UI, red IELTS label, candidate header and server-owned timer;
gray part banner, independent resizable panes, compact question navigation,
answered/flagged states, previous/next controls and explicit finish review.
The Options overlay provides black-on-white, white-on-black, yellow-on-black
contrast and Regular/Large/Extra large text without changing the site theme.
Mobile uses passage/question tabs instead of unusably narrow columns.

Selection offers Note, Highlight and Clear. Highlights use the CSS Highlights
API and validated text offsets; React-owned DOM is never rewritten. Notes and
highlights are temporary, scoped to the current attempt page. They survive
in-page passage/section changes, but are not submitted answers or account-saved
notes. Browsers without CSS Highlights can still use notes and get a visible
unsupported message for highlighting.

## Preserved exam behavior

The existing headphone check gates the start. Listening uses the existing
recording without synthesized speech, pause/seek controls or replacement audio.
Server deadlines, no-break progression, serial acknowledged autosave, device
backup, conflict handling, submission/retry and teacher-led workflows remain
owned by the existing orchestrator and runners. Account save status stays
visible; an unconfirmed save never becomes a cosmetic “Saved” badge.

The uploaded HTML is a visual reference only. Its scripts, embedded answer
keys, client-side marking, administrator password and timer bypass were not
copied into the app. The raw source is not part of the deployment.

## Verification

- 512 unit/regression tests across 64 files, including 16 interface tests.
- TypeScript and Next lint.
- Local Chromium: 20 functional assertions for isolation, contrast, highlighting,
  notes, question navigation, review, acknowledged autosave, sound check,
  offline retry and deadline progression.
- Desktop 1440×900 and mobile 390×844 visual inspection, including options,
  notes, finish review, audio playback, writing and save failure.
- Browser tests use synthetic attempts and a short generated test tone; no
  student attempt or production answer is written during QA.

## Advisory focus mode (CDI only)

- Running cd-v1 sittings make background Averna chrome inert and suppress the global command-palette shortcut. A global student-only guard checks the authenticated owner's active CDI attempt and covers other Averna pages with Return to Mock / confirmed Leave. This is a UI restriction, not kiosk software, an OS/browser tab lock or authorization for other APIs.
- Optional fullscreen is offered before independent and group starts. Unsupported devices can continue. Exiting fullscreen does not fail an attempt.
- `visibilitychange` hidden→visible creates one advisory episode (not window blur). On return the student sees a warning; clocks, recording, drafts, grading and progression are unchanged. Closing/reloading uses the browser's native unsaved-page prompt.
- The bounded device queue retries with stable UUIDs. Beacon delivery is best-effort and retained until an acknowledged POST. Duplicate insertions cannot inflate counts; late returns update only their own matching attempt/event. Up to 64 pending device reports / 1000 stored reports per sitting; overflow, offline devices, cleared storage and disabled JS can cause incomplete coverage. This is not secure proctoring.
- New additive `mock_focus_events` storage contains attempt/event IDs, kind, section, client-observed leave/return times, capped duration and receipt time. No URLs, tab titles, clipboard, camera or screen content. No score penalties. Unconfirmed returns have unknown duration; timestamps/durations are client-observed and unverified.
- `/api/mock/[id]/focus` enforces origin, live student role/blacklist, owner, version, bounded JSON/schema/time range and rate/cap limits. It never writes attempts, clocks, answers or results. `/api/mock/active` returns only an owned active CDI ID with private/no-store headers.
- Teacher journal `/teacher/mock/attention`: current teacher-group scope (admin all), paged attempts, batched count/duration summaries and bounded episode detail. Coverage is explicit; zero reports never proves continuous attention. Linked from Mock analytics and group participant cards. Existing group cancellation remains teacher-controlled; students cannot cancel a whole class by leaving.
- Rollout: generate Prisma client; normal additive `prisma/sql/deploy.sql` creates the table/indexes without replacing content. Migration is also recorded under `20261011000100_mock_focus`. Older attempts do not receive invented historical events.
