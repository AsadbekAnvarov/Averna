# Elegance roadmap

Shared tracker for the `feat/elegance-roadmap` branch. One commit per idea, worked in this order.

| # | Idea | Status |
|---|------|--------|
| 9 | Simpler navigation | Done |
| 1 | One Continue button — Daily Session | Done |
| 2 | Band forecast and path to target | Done |
| 5 | Show me where — evidence in results | Done |
| 8 | Native-language hints + comfort settings | Planned |
| 10 | AI + teacher loop | Planned |
| 7 | Instant and offline | Planned |
| 3 | Realtime AI speaking partner + pronunciation map | Planned |

### 9 — Simpler navigation (done)

Student sidebar went from 31 items in 5 overlapping groups to 16 items in Home · Skills · Practice · Coach · Me (data in `components/layout/portal-navigation.ts`, longest-prefix highlighting incl. hub children).
New `/coach` hub gathers AI Examiner, AI Mentor, Averna AI, Essay X-Ray, Roleplay, Learning DNA, Speaking partner and 1-on-1 tutoring; the phone tab bar is Home · Skills · Practice · Coach · Me.
Pages that left the sidebar are linked from their hub (Studio, Learning Center, Speaking, Calendar, Profile, Inbox) and found in ⌘K by name or synonym; "New" badges expire on `NEW_BADGE_UNTIL`.

### 1 — One Continue button (done)

Today opens on one hero, "Today's session": a 2–4 step plan from the pure planner `lib/session/daily-plan.ts` (warm-up → overdue homework → weakest-skill task sized to 5 / 10 / 20 min → 20-min bonus), checkmarks from today's activity logs only, a progress ring and a single Start / Continue button (sticky on phones while scrolled away).
`GET /api/session/today` refreshes the checkmarks when the student comes back; every step link carries `?from=session`, and `<SessionReturnBar/>` in the app shell offers "Today's session · step N of M — Back". The 60-second warm-up now logs `WARMUP_COMPLETED` (0 XP) so its step can tick.
Removed from Today: the welcome hero (points/rank/quote/level — level stays on Progress), "My next 15 minutes" (the `/study/next` page still works), Today's Mission and "Averna recommends" (merged into the session; the mission's XP bonus and badges still settle in the background), and the habit nudge. Below the hero: streak + exam countdown beside it, then homework, skills, challenges + badges.

### 2 — Band forecast and path to target (done)

The pure model `lib/forecast/band-forecast.ts` (runs on server and client) fits a recency-weighted linear trend per skill over the last 120 days (weight halves every 30 days). The slope is clamped to −0.25…+0.5 band per 30 days, the what-if included. "Now" is the fitted line at today. The range is the weighted residual SD (at least 0.25) × (1 + 1/√n), floored/ceiled to half bands.
Honesty rules: fewer than 2 results → "Take 1 more Listening test to see your forecast"; results less than 7 days apart → too early (level only, date when a trend becomes possible); slope ≤ 0 → flat, so no date, advice instead. The path is the day the line reaches target − 0.25 (which IELTS rounds to the target) within 365 days, with an earliest–latest window and a before/after-exam check. The overall uses the IELTS rule on the four half-band "nows", and only when all four skills have a forecast.
Evidence comes from the progression engine's cached `loadSessions`. Only full-ish attempts count (the XP minimums: ≥ 10 questions, Writing/Speaking word and second floors), and only the first attempt of a paper or prompt (retakes are memory-inflated). Pace is sessions per week over the last 4 weeks. The what-if multiplies the slope by 1 + 0.15 × extra sessions per skill a week, capped at ×1.6.
UI: Progress (page and tab) opens on `BandForecastCard`: overall "Now ≈ X.X (range) · at this pace 7.0 by …", four skill rows with an accessible sparkline (past results + dashed projection), trend arrow, path window or a practice link, a 0 / +1 / +2 / +3 segmented what-if with an aria-live summary, and the footnote "Estimates from N results. Real exam conditions vary."
Today: `PathToTargetCard` ("Path to 7.0" + exam date, same `averna_exam_date` key) sits under the streak and links to `/progress#forecast`.
Replaced: Exam Countdown (merged into Path to target), and BandProgress / "Practice evidence" on Progress, the Progress tab and `/learning` (where the compact card now sits beside the Skill Radar). `PracticeReadiness` stays behind the AI Clone entry point. The Progress tab now opens on the forecast; Skill Radar pairs with Level, and Weekly goal sits under DNA + achievements.

### 5 — Show me where (done)

The pure locator `lib/review/evidence.ts` finds the sentence that answers each wrong or blank question. Explicit quotes come first: the ‘…’ / “…” / '…' segments of the explanation, matched despite whitespace, quote-mark and case noise, then punctuation-blind, then by token overlap. Without a usable quote it derives the sentence: the gap answer as an exact phrase dominates, then shared content words from the explanation, question, template line and accepted option (stop-words out, light stemming, rarer words weigh more), with "Paragraph C" / "sixth paragraph" references preferred (required when the answer or question names the paragraph). Below the threshold it returns null instead of a random sentence. On the built-in papers 318 of 320 questions resolve from quotes and 2 are derived.
Reading result: each mistake gets "Show in text". On desktop the passage sits beside the answers (sticky, own scroll) and the sentence is highlighted in place. On phones a bottom sheet opens on the sentence with "Back to question N". The highlight is a `<mark>` in the exam highlight colour (no padding, so no layout shift), focused with tabindex −1 and announced ("Evidence for question 7 highlighted"); a second tap ("Hide") removes it.
Listening result: the page now loads each part's ready recording (`listeningClientContent`, after submission only) into a small result player. "Hear it" plays from the evidence time − 2 s (the line's timeline start plus the evidence's share of the line); "Show in transcript" highlights the transcript sentence the same way. Single-file recordings have no line timeline, so they get the transcript only.
"Your mistakes by type" sits beside "Accuracy by question type" (DashRow, owner only): "Matching headings — 3 of 5 wrong → Practise matching headings" links to one part of another test of the same skill. The picker `lib/review/practice-by-type.ts` goes through: another paper not done yet → another paper → this paper. Catalog summaries now carry per-part kinds, with matching split into headings / information (`practiceKindOf`). Done keys come from a key-only SQL projection.

Not in scope now: 4 (personal mistake deck) and 6 (Telegram Mini App — to be discussed separately with the owner).

## Shared principles

- Phone first, desktop comfortable.
- Phone tap targets ≥ 44 px; body text ≥ 14 px; no text smaller than 11 px.
- Light and dark themes through design tokens only.
- No new per-route function config (`maxDuration`, `preferredRegion`, `memory`).
- Every existing route keeps working.
- Student UI in English (native-language hints are optional secondary text); admin UI stays Uzbek.
- One commit per idea.
