# Supplied CDI materials: staged import

This change adds support for imported, uncut Listening recordings and actual supplied diagrams. It does not enable Group Mock, publish papers or migrate production automatically.

## Safety and behaviour

- Supplied whole recordings have one audio row at partIndex -1, with an actual file SHA-256, measured duration and content fingerprint. The four question parts remain navigable without restarting the recording.
- Missing/stale/off recordings fail closed in Group Mock. Imported full recordings never fall back to browser voices, transcript endpoints or paid audio generation.
- Reading/Listening keys stay server-side. Archive HTML/JavaScript is never shipped or executed. Questions are converted into existing typed exam components.
- Writing Task 1 uses the real uploaded chart; no chart numbers, sample essay or strategy is fabricated. Existing generated Writing validation remains unchanged.
- Writing samples and oral discussion questions are teacher-only resources. They are not verified band scores or complete Speaking tests. Speaking and Writing are assessed and published by the responsible teacher in teacher-led Group Mock.
- Source inconsistencies are quarantined, not silently repaired. Formal accepted-answer filtering only removes over-limit alternatives when a valid supplied alternative remains; preserve an external audit of such normalization.

## One-time import

Keep source archive, question keys, manifest, credentials and uploads outside the public repository.

1. Convert source literals without executing JavaScript; preserve source filename/SHA provenance.
2. Validate complete 40-question objective papers and Writing prompts. Keep failed files for review.
3. Upload only referenced images and the corresponding original, uncut MP3s. Resolve every placeholder to an actual HTTPS media URL; validate again.
4. Create manifest version 1, items with unique cdi-* IDs, module/title/data, validated true and SHA-256 of JSON.stringify(data). Listening audio requires partIndex -1, URL, bytes, measured duration and wholeRecordingHash(data).
5. Dry run: `node scripts/import-cdi-manifest.cjs /private/path/manifest.json`.
6. Apply only to the explicitly selected isolated database, with DATABASE_URL supplied privately and `--apply --expected-host=EXACT_HOST`. Rows are created unpublished. Existing published/non-import rows are never overwritten.
7. Verify media hashes/range delivery, catalog/readiness, access control and teacher publication on staging before any separate production import or flag enablement.

## Local verification

- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- With esbuild/playwright available: `node e2e/imported-recordings.cjs` (local Chromium). It checks mobile/desktop whole playback, navigation without restart, clock transition, no transcript fallback and overflow/errors. This is not certification of physical phones or a live teacher interview.

## Volume 10
The 8 Reading and 6 Listening papers of Volume 10 have their own offline importer and owner steps: [cdi-volume-10-import.md](cdi-volume-10-import.md).
