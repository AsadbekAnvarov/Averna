# Supplied Volume 10 papers

- 8 Reading papers (3 passages and 40 questions each).
- 6 Listening papers (4 parts and 40 questions each), 6 unchanged original MP3 recordings, 24 verified original-audio clips, 4 supplied diagrams.
- Same database records feed the Averna practice catalog and existing CDI Mock picker; no parallel public answer-key files.
- Full Listening and Mock retain the original uncut recording. Individual practice uses independently hashed, ready clips only. Missing or stale clips disable individual scope; supplied audio never falls back to generated speech.
- Practice mode changes start a new attempt after confirmation and flush the old draft. Homework and Mock do not expose practice-scope changes.

## Import safety

`node scripts/import-volume10.cjs` is a no-op unless a production-only `AVERNA_VOLUME10_IMPORT_SHA256` matches the complete private manifest. Private inputs are not committed and are not placed under `public/`.

The importer validates every paper, self-grades source keys at 40/40, verifies asset checksums, uploads immutable media, refuses conflicting IDs or already-imported source checksums, and creates/publishes exactly the 14 allowed IDs in a single database transaction. Existing papers, attempts, student records and schema are not modified. An exact rerun verifies rows rather than overwriting them.

Archive scripts were parsed statically with a literal-only whitelist, never executed. Paragraph labels, numeric option text, heading examples, lesson-plan context, maps and diagrams are retained. Two spelled-out decimal alternatives in Listening 1 (Q38 and Q39) exceed that source's own two-word instruction; those incompatible alternatives were excluded while retaining all source numeric and valid two-word alternatives.

Recording cuts were checked against word-timed local transcription of the actual section announcements/topic introductions, not inferred from equal durations or generic pauses. Clips use MP3 packet copying, without synthesized audio. Full source recordings and their checksums are unchanged.

## Verification

- 14 complete papers, 560 unique numbered question slots.
- Full-paper structural validation; all source answer sets self-grade 40/40.
- Unit/regression tests cover full/part selection, draft-save failures, cancellation, Mock/homework isolation, absent/stale clips, fingerprints and client answer-key stripping.
- TypeScript, lint, and desktop/mobile rendering of real practice and Mock components.
