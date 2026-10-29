# Implementation Plan

Work on branch `feat/v10-tests-articles-listening-parts`, stacked on `feat/elegance-roadmap`. Ordered so the Vercel preview shows results as early as possible.

- [x] 1. Articles back in the student sidebar and other entry points
  - [x] 1.1 Add «Articles» (`/article`, Newspaper icon) to Skills right after Reading in `components/layout/portal-navigation.ts`; remove `also: ["/article"]` from Reading
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.9_
  - [x] 1.2 Make the ⌘K «Articles» command visible without a query (Newspaper icon, synonyms article/news/lessons) in `components/command-palette.tsx`
    - _Requirements: 9.1, 9.2, 9.7_
  - [x] 1.3 Add a link to `/article` with the lesson count on `/learning/reading` before the test list
    - _Requirements: 9.6, 19.1_
  - [x] 1.4 Update Navigation_Tests only in the three places listed in 8.6; add new checks in a separate test file
    - _Requirements: 8.6, 8.8, 16.7_

- [x] 2. Checkpoint: tsc, lint, vitest green; commit

- [x] 3. Part boundaries for whole recordings
  - [x] 3.1 Pure `lib/ielts/segments.ts` (validateSegments, isVerified) and `lib/ielts/audio/mp3-index.ts` (indexMp3, framesInRange, buildClip)
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.7, 10.9, 10.10_
  - [x]* 3.2 fast-check properties for segment validation and clip assembly
    - _Requirements: 22.7_
  - [x] 3.3 Additive `listening_part_segments` table (schema.prisma, deploy.sql, migration) and `lib/ielts/segments-store.ts` with revision-based concurrency
    - _Requirements: 10.6, 10.8, 11.9, 20.2_
  - [x] 3.4 `PUT /api/admin/listening-audio/segments` (session, ADMIN/TEACHER, zod, rules, 409 on stale revision) and the Uzbek «Qismlar chegaralari» block in the Audio_Manager
    - _Requirements: 11.1–11.10, 18.2, 18.6_
  - [x] 3.5 Catalog Splittable_Paper state, Listening_Library part rows, Listening_Runner `?part=` single-part mode, submit 409 `part_unavailable`
    - _Requirements: 12.1–12.5, 13.1–13.9, 14.1–14.8_
  - [x] 3.6 Homework, mini task, practice picker, offline pack and evidence integration for verified parts
    - _Requirements: 15.1–15.10_

- [x] 4. Checkpoint: tsc, lint, vitest, build, function-size green; commit

- [ ] 5. Volume 10 Content_Importer
  - [ ] 5.1 Pure modules in `lib/cdi-import/**` (payloads, dom, literals, packed-audio, groups, reading, listening, transcript, evidence-windows, images, silence, boundaries, key-check, guard, instructions, manifest, report, budget)
    - _Requirements: 1.1–1.12, 4.1–4.13, 5.1–5.3, 10.4, 10.11, 18.4, 18.5, 18.7_
  - [ ] 5.2 CLI `scripts/cdi-v10/import.ts` (dry-run, stage, verify), publish script and extended `import-cdi-manifest.cjs`
    - _Requirements: 5.4–5.11, 16.3–16.9, 17.1–17.10, 20.6, 20.7_
  - [ ]* 5.3 Synthetic fixtures and tests: key → 40/40, determinism, no script execution, import guard
    - _Requirements: 22.2, 22.5, 22.6_
  - [ ] 5.4 L1 instruction fixture and coverage test for the new papers
    - _Requirements: 21.1–21.7_

- [ ] 6. Mock and Group Mock checks, `validate.ts` relaxation for supplied recordings, attempt resolvers for unpublished papers
  - _Requirements: 3.1–3.8, 6.1–6.10, 7.1–7.8, 17.6, 17.8_

- [ ] 7. Docs, e2e and final verification
  - [ ] 7.1 Volume 10 import doc linked from `docs/cdi-materials-import.md`; idea 9 update in `docs/elegance-roadmap.md`
    - _Requirements: 22.4_
  - [ ] 7.2 `e2e/screens.mjs` additions for the sidebar Articles item and Listening part rows
    - _Requirements: 22.3_
  - [ ] 7.3 tsc, lint, vitest, build, function-size; commit tagged `[screens] [preview]`; push and check the preview
    - _Requirements: 20.1, 20.3, 22.1_
