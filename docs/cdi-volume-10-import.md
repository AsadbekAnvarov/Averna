# Volume 10 import (8 Reading + 6 Listening papers)

The Volume 10 papers are converted by an offline importer and reach the app through the
same staged path as the other Averna CDI papers (see [cdi-materials-import.md](cdi-materials-import.md)).
Nothing here runs on Vercel, and the importer is not part of the function bundle.

Keep the source HTML files, the manifest, the report, the media and every credential outside this
public repository. The importer refuses an `--out` folder inside the repository.

## Papers

| Reading | Listening |
|---|---|
| `cdi-v10-reading-01` … `cdi-v10-reading-08` | `cdi-v10-listening-01` … `cdi-v10-listening-06` |

Titles are "Volume 10 · Reading Test N" / "Volume 10 · Listening Test N", difficulty Medium,
source "imported" (label "Averna CDI"). There are no Listening tests 7–8 in the supplied folder,
so none are created.

## What the importer does

- Parses each HTML file with parse5 and reads the script data (`correctAnswers`,
  `textAnswerRules`, matching lists …) with acorn. The source scripts are never executed.
- Converts every "Questions N–M" block to an existing group kind (tfng, ynng, mcq, mcq-multi,
  matching, gap, gap-box) and keeps every key alternative in source order. Explanations stay empty.
  A gap alternative longer than the group's word limit is left out with a warning (the grader
  would never mark it correct).
- Extracts each Listening recording byte for byte (base64 data URI in tests 1–2, the gzip
  "utf8-seven-bit" block in tests 3–6), measures it by its MP3 frames and extracts question
  images as PNG files. Media paths depend only on the paper id and the file SHA-256.
- Checks every paper: `validate*Test` with the full shape, the source key graded by the app's
  grader (first and last alternatives must both score 40/40), no "IELTS_Volume" or `t.me`
  reference, and no L1 hint on question content. A failing paper is left out of the manifest.
- Proposes part boundaries for each whole recording from pauses (≤ −40 dBFS for ≥ 1 s, decoded
  with mpg123-decoder) and the source's answer windows (tests 3–6). They are suggestions only:
  staff confirm every boundary by ear in the Audio Manager before a part can be practised alone.

## Owner steps (pwsh)

1. Dependencies: `npm ci`.
2. Dry run (no database, no network):

   ```powershell
   npm run cdi:v10 -- dry-run `
     --reading "C:\Users\asadb\Downloads\Telegram Desktop\New Reading" `
     --listening "C:\Users\asadb\Downloads\Telegram Desktop\New Listening" `
     --out "C:\Users\asadb\averna-private\cdi-v10" `
     --media-base "https://<owner>.github.io/averna-cdi-audio/"
   ```

   Read `report.md`: 14 rows, all "in manifest", 40/40 twice, the durations, the boundary
   candidates and 0 L1 hints on content.
3. Upload the media to the GitHub Pages repository (a local clone with push rights). The command
   checks the host, the clone's origin and the 1 GB budget first; without `--apply` it only prints the plan.

   ```powershell
   npm run cdi:v10 -- stage --out "C:\Users\asadb\averna-private\cdi-v10" `
     --pages-repo "C:\Users\asadb\src\averna-cdi-audio" --apply --expected-upload-host <owner>.github.io
   npm run cdi:v10 -- verify --out "C:\Users\asadb\averna-private\cdi-v10"
   ```

   `verify` downloads every file, compares its SHA-256, checks a Range request (206) and the CORS
   header, then rewrites `manifest.json` with the HTTPS URLs (the unresolved copy stays as
   `manifest.pending.json`).
4. Apply as unpublished papers (dry run first). Put the connection string only into the current
   session's environment:

   ```powershell
   $env:DATABASE_URL = "<from the password manager>"
   node scripts/import-cdi-manifest.cjs "C:\Users\asadb\averna-private\cdi-v10\manifest.json"
   node scripts/import-cdi-manifest.cjs "C:\Users\asadb\averna-private\cdi-v10\manifest.json" --apply --expected-host=<database host>
   ```

   The import stops before the first write when `listening_part_segments` is missing (apply
   `prisma/sql/deploy.sql`) or when any id belongs to a published or non-import paper.
5. Confirm part boundaries: `/admin/listening-audio` (or `/teacher/listening-audio`), block
   "Qismlar chegaralari" of each Listening paper: listen to the three boundaries, move them by
   ±0,1 s if needed, press "Tasdiqlash". Until then the paper is practised only as a full test.
6. Publish (dry run first):

   ```powershell
   $ids = ((1..8 | ForEach-Object { "cdi-v10-reading-{0:D2}" -f $_ }) + (1..6 | ForEach-Object { "cdi-v10-listening-{0:D2}" -f $_ })) -join ","
   node scripts/cdi-v10/publish.cjs "--ids=$ids"
   node scripts/cdi-v10/publish.cjs "--ids=$ids" --apply --expected-host=<database host>
   ```

   The papers appear in the libraries, homework, practice picks, Mock and Group Mock within 300 s.
7. Roll back with the same command and `--unpublish`. Papers, recordings, boundaries and results
   stay in the database; started mock sections can still be finished.
8. `Remove-Item Env:DATABASE_URL` at the end of the session.

If preview and production share a database, steps 4–7 act on production too.

## Known source details

- Reading Test 2, questions 27–31: the word box is declared "A–J" but has no letter I. It is kept as in the source.
- Listening Test 1, questions 38–39: the spelled-out alternatives exceed the 2-word limit and are left out.
- Listening Test 3: the frame sum is 29:52.4 (the 29:54 estimate included the 44 KB ID3 tag).
- Listening Test 4, question 40: the source's answer window ends after the recording and is dropped.
- Boundary candidates of tests 1–2 are rough (no answer windows in the source); staff must check them by ear.
