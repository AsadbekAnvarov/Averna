# Articles library

The existing authenticated `/article` student entry now opens a permanent library, not a date-dependent rotating article. Sidebar, command palette, Learning Center and dashboard card use **Articles**. Existing `/article` bookmarks still work. Individual lessons use `/article/[slug]`; missing slugs return 404. The old daily pool and database rows are retained, not deleted.

## Supplied content

- 10 **Pre-intermediate** lessons from `pre intermediate article.zip`.
- 1 **Intermediate** lesson: **What Are They Like?**, from `intermediate article.zip`.
- All 11 source article texts retained (non-whitespace characters compared during conversion), including original headings, highlighted words and caption text.
- 82 vocabulary entries; 221 objective questions in 35 exercise sets; original discussion prompts, writing instructions and Intermediate memory/prefix notes.
- Original exercise keys are retained. These are transparent self-study activities with an explicit Show answers action, not secure exams or IELTS band/XP assessments. Choices/corrections/writing are page-local only, with an explicit warning that navigating/reloading clears them. Show answers does not overwrite a student's choices.
- Device text-to-speech and the existing dictionary/My words integration are reused. No claim of original recorded audio.

## Storage and safety

`lib/articles/catalog.json` contains plain structured data, source filenames and SHA-256 digests. It is versioned with the application; no expiring attachment URLs, database seed or temporary Neon branch is needed. Source scripts are **not executed** or included in the app. Rendering uses React text nodes and explicit highlight elements, never raw HTML injection. No remote fonts or assets from the source HTML are required.

For a reproducible import, extract the archives into `source/pre-intermediate/` and `source/intermediate/`, then run (Python + BeautifulSoup):

```
python scripts/import-article-lessons.py /path/to/source
```

Raw HTML archives are not committed. No Prisma schema, CDI resolver, exam policy, user data, stored attempts, environment variables or production database settings are changed by this feature.

## Checks

- Full suite: 488 tests / 62 files passed, including 16 new catalog/interaction tests.
- TypeScript, lint and Next production build passed locally.
- Actual React components in a local Chromium fixture: all 11 lessons and library at 390px/1440px, light/dark (48 route/viewport/theme combinations); no horizontal overflow or browser errors; level filtering and exercise actions checked.
- Desktop/mobile library, reading and exercise screenshots visually inspected.

Deploy using the established **averna-y5ks** production environment, retaining its permanent main database. Do not replace the active CDI branch alias with a preview connected to an expired staging database. The separate feature branch is based on the existing CDI/UI commit `7103f2a9d6943ef8c05c91a3f96022955469f164` to avoid regressing prior work.
