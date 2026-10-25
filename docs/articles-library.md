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

`lib/articles/catalog.json` contains plain structured data, source filenames and SHA-256 digests. It is versioned with the application; no expiring attachment URLs, database seed or temporary Neon branch is needed. For these 11 structured lessons, source scripts are **not executed** or included in the app. Rendering uses React text nodes and explicit highlight elements, never raw HTML injection. No remote fonts or assets from the source HTML are required. The one exception is the 13 interactive lessons below, whose own scripts run, isolated in a sandboxed frame.

For a reproducible import, extract the archives into `source/pre-intermediate/` and `source/intermediate/`, then run (Python + BeautifulSoup):

```
python scripts/import-article-lessons.py /path/to/source
```

Raw HTML archives of the structured lessons are not committed. No Prisma schema, CDI resolver, exam policy, user data, stored attempts, environment variables or production database settings are changed by this feature.

## Interactive Intermediate lessons

13 more **Intermediate** lessons (English File topics: food and cooking … word building), each a self-contained HTML file with its own engine: reading text, flip cards, matching, a speed round, quizzes, writing with a goal, badges and XP. The user asked to keep their logic, so the files are **served unchanged** and their scripts run, in the student's browser only. Library and dashboard counts: Intermediate 1 + 13, Pre-intermediate 10, all 24. The structured lessons are unchanged and listed first.

- **Files**: `content/articles/intermediate/NN-<slug>.html`, byte-identical to the supplied files (`.gitattributes` `-text`, SHA-256 in `lib/articles/interactive.json` and checked by tests). The JSON holds metadata only (title, topic, emoji, description, word counts).
- **Route**: `/article/<slug>` (e.g. `/article/food-and-cooking`) shows a full-screen view with a frame loading `/api/articles/lesson/<slug>` (signed-in users; 401/404 otherwise). That response is the file plus a small shim as the first `<head>` child; the two inline scripts get `type="text/x-averna-deferred"` (content untouched) so the shim can start them once saved progress has arrived (`lib/articles/lesson-document.ts`).
- **Isolation**: the frame has `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals"`, never `allow-same-origin`, so the lesson runs in an opaque origin and can't read the app's cookies, storage or DOM. The response's CSP repeats the sandbox (so the document stays isolated if opened directly), blocks all network calls (`connect-src 'none'`), allows only inline code and the lesson's Google Fonts, and `frame-ancestors 'self'`. No X-Frame-Options (it would block the app's own opaque-origin frame).
- **Bridge** (`lib/articles/lesson-bridge.ts`, `components/articles/interactive-lesson.tsx`): the shim replaces `localStorage` with an in-memory store. It says `hello` to the app page; the page answers with the student's saved values and the app theme (light/dark, also sent on every theme change; the lesson's own toggle still works). Every write is posted back and saved in the app's localStorage as `averna_lesson:<userId>:<key>`, so each student on a shared device has separate progress, and all interactive lessons share one key space like the files did on their own. The page accepts only messages from its frame (`source` is the frame, origin `"null"`), keys matching `^[\w.:-]{1,120}$` and string values ≤ 100 000 characters. Lesson keys: `efvocab-v1-<id>`, `efvocab-v1-<id>-draft`, `efvocab-mute`, `efvocab-name`, `speed-<id>`. A lesson reset reloads the frame, which repeats the handshake with the updated values. If the frame doesn't answer within 10 s the page offers Retry.
- **Import**: `node scripts/import-interactive-articles.mjs "<folder with the 13 files>"` (Node only, no extra packages) copies the files and rewrites `interactive.json`. It reads metadata by evaluating only the `window.UNIT = …` script in a `node:vm` context (offline tooling, never at runtime) and checks: 13 files, all Intermediate, the engine script identical in every file, exactly two attribute-less inline scripts, unique slugs not used by the structured lessons.

## Checks

- Full suite: 488 tests / 62 files passed, including 16 new catalog/interaction tests.
- TypeScript, lint and Next production build passed locally.
- Actual React components in a local Chromium fixture: all 11 lessons and library at 390px/1440px, light/dark (48 route/viewport/theme combinations); no horizontal overflow or browser errors; level filtering and exercise actions checked.
- Desktop/mobile library, reading and exercise screenshots visually inspected.
- Interactive lessons: full suite 644 tests / 77 files, including source SHA-256, served-document round trip, static safety scan, shim (jsdom), bridge properties (fast-check), route and component tests. Build traces the 13 files into the route's function; no lesson code in `.next/static`. Checked in Chrome: opaque origin, handshake, writes, reload, theme, direct opening. e2e/screens.mjs shoots the Intermediate library and `/article/food-and-cooking` (phone and desktop).

Deploy using the established **averna-y5ks** production environment, retaining its permanent main database. Do not replace the active CDI branch alias with a preview connected to an expired staging database. The separate feature branch is based on the existing CDI/UI commit `7103f2a9d6943ef8c05c91a3f96022955469f164` to avoid regressing prior work.
