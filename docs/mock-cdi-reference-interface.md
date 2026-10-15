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
