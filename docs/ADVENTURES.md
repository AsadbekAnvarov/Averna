# Adventures — mobile-first guided practice

A prominent Today dashboard card, a direct student menu item (also in the phone drawer), one Practice Studio shelf item and one student quick-jump entry lead to `/studio/adventures`; six modes live under that route. Existing dashboards, exams, grading, XP, finance and paid AI services are not replaced or changed by this block.

## What is implemented

- **A new chapter**: two original three-reply stories. Choosing an action changes the next scene. The application does not interpret the meaning of a typed reply or generate new story content.
- **English Detective**: two cases with three clues each, an objective conclusion key and a written explanation. Prepared voice-note text uses browser read-aloud, explicitly labelled as such; a transcript is always available.
- **Debate Arena**: three motions, both positions and three prepared challenges per position. Replies, reflection and switching sides work; this is not a live AI opponent.
- **Save the situation**: three scenarios with three turns, language constraints and optional 45-second timing. Timing and restricted words never destroy/block a reply; backgrounding pauses the timer.
- **Question Workshop**: a personal passage, one to five four-option questions, author-written explanations/keys, permission attestation, objective preview and JSON export. Class submission, teacher review and class library are implemented behind the default-OFF flag below.
- **Voice time capsule**: actual microphone recording, preview, explicit local save, export, two-recording comparison for the same question and explicit permanent deletion. No simulated audio, automatic band/fluency grade or cloud audio upload.

All material supplied with Adventures is original prepared practice, not licensed IELTS test content. Students must write or have permission to share their passages. No HTML supplied by students is executed.

## Device drafts and audio

Text drafts are bounded, schema-checked, account-scoped browser `localStorage`. Choices and replies resume per activity/position. Owner changes do not render another owner's draft. A failed storage write retains visible text and shows a copy-before-leaving warning. Restart requires confirmation. These drafts are device-only, not encrypted, and cannot be recovered after browser-data clearing; each activity has a reset control.

Voice capsules use account-scoped IndexedDB, not server storage. Recording begins only on the user's click; saving additionally requires explicit acknowledgement. Limits: eight recordings per owner/device, 120 seconds and 4 MB each, notes up to 300 characters. Capacity checks and inserts share one IndexedDB transaction. Codec selection checks browser support (WebM/MP4/Ogg); compatible HTTPS browsers and microphone permission are required. Export important recordings before clearing browser data or sharing the device.

Unsaved previews remain only in memory. A new recording cannot silently replace one. Backgrounding stops recording and makes an unsaved preview; leaving the page/account stops all tracks and drops that preview. Browser storage is not an authentication/security boundary: another person with access to this browser/device can inspect it. Optional speech-to-text uses the browser speech service, which may process audio externally; this disclosure is shown next to Dictate. Typed replies are always available.

## Class sharing: isolated staging only before enablement

`ADVENTURE_WORKSHOP=off` is the safe default. Personal creation, preview and export work without the new table. Sharing-off routes make no class API requests; the API returns 404 before touching auth/database.

Before changing the flag:

1. Review the independent migration `prisma/migrations/20261010000100_adventure_workshops/migration.sql` against the actual migration history, including parallel PRs. It is deliberately **not** appended to `prisma/sql/deploy.sql` and not silently applied to production.
2. Restore-test a backup and apply only this reviewed migration to an isolated staging database using the established migration process. Do not use an indiscriminate production `db push` or run all historical migrations blindly.
3. Enable the flag in that staging deployment. Test two distinct classes, current assigned teachers, blacklist/group/role changes, real concurrent PostgreSQL requests and revision conflicts.
4. Obtain school approval for student name/content sharing, a retention policy and handling of older submissions. Lists show the 25 latest items (and explicitly disclose additional stored items); older deletion requests currently need the support process. Only then decide production enablement separately.

The API resolves current database roles, rejects cross-origin writes, limits body bytes and requests, uses authenticated identity only and returns private/no-store responses. Students can submit and withdraw only their own versioned items. A replayed request UUID returns the same identical submission; changed payload/group with that UUID is a conflict. The browser retains that UUID during retries on the mounted page, not across reloads.

A submission starts **unpublished**. Only the current assigned class teacher may decide. Approval requires a UI acknowledgement; rejection needs feedback. Both mutations are version-checked. The class library includes approved items only from active student authors still in that same current class. A teacher can return an approved item to remove it from the library; an author can withdraw it. Reads do not expose email addresses or other classes. Role/class/blacklist transitions are rechecked by the read query and transactional write service. Row locks do not substitute for real multi-connection acceptance tests.

Flag-off rollback stops sharing/API access without deleting stored submissions. Do not drop the table as rollback. Local activities and recordings do not depend on the new table. No provider credentials, scheduler or paid plan is provisioned.

## Validation

- New Vitest tests cover activity graphs, answer/schema/permission/byte bounds, owner isolation and quota-preserved text, response gating, sharing-OFF, teacher approval boundaries, origin/current-role/body/limit/cache API rules, and WCAG AA token contrast.
- `scripts/verify-adventure-workshops.cjs` runs the **actual service and migration** on isolated PGlite: idempotency, own/group/role isolation, current teacher approval, withheld publication, stale versions, blacklist/transfer, withdrawal and FK cascade. It does not certify production PostgreSQL concurrency.
- `e2e/adventures.cjs` bundles the actual UI with synthetic account/content/API fixtures. It checks all eight screens at 320/390/1440 px in light/dark (48 layout checks), completion flows and actual Chromium MediaRecorder + IndexedDB save/reload/playback/compare/export/delete/capacity/owner cleanup and denial/negative states. PNGs must be inspected individually; rendering alone is not visual approval.
- `e2e/adventures-entry.cjs` checks the visible Today entry at 320/390/1440 px in both themes and follows its link to all six modes. Navigation tests cover the desktop/phone drawer shortcut, most-specific active highlighting and keeping staff menus separate.
- Existing `e2e/screens.mjs` now includes the catalogue, six student routes and teacher page in its seeded authenticated screenshots. Existing Screens workflow runs on `[screens]` commit messages. The separate synthetic QA script is **not automatically wired** into CI, and this PR does not claim otherwise.

Local optional QA tooling (kept outside the repository dependency lock):

```sh
npm install --prefix /tmp/averna-adventure-qa --no-package-lock @electric-sql/pglite esbuild playwright
NODE_PATH=/tmp/averna-adventure-qa/node_modules node scripts/verify-adventure-workshops.cjs
NODE_PATH=/tmp/averna-adventure-qa/node_modules CHROMIUM_PATH=/path/to/chromium node e2e/adventures.cjs
npm test
npx tsc --noEmit
npx next lint --max-warnings=0
npm run build
```

Remaining acceptance: physical iOS Safari/Android browsers, mobile keyboard and permission interruptions, VoiceOver/TalkBack, codec playback/export on those devices, dictation-service privacy, real two-device/class staging and production PostgreSQL concurrency/retention. Desktop Chromium viewport emulation is not certification of every phone. No real learner data or AI provider was used for local verification.
