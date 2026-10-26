# Elegance roadmap

Shared tracker for the `feat/elegance-roadmap` branch. One commit per idea, worked in this order.

| # | Idea | Status |
|---|------|--------|
| 9 | Simpler navigation | Done |
| 1 | One Continue button — Daily Session | Planned |
| 2 | Band forecast and path to target | Planned |
| 5 | Show me where — evidence in results | Planned |
| 8 | Native-language hints + comfort settings | Planned |
| 10 | AI + teacher loop | Planned |
| 7 | Instant and offline | Planned |
| 3 | Realtime AI speaking partner + pronunciation map | Planned |

### 9 — Simpler navigation (done)

Student sidebar went from 31 items in 5 overlapping groups to 16 items in Home · Skills · Practice · Coach · Me (data in `components/layout/portal-navigation.ts`, longest-prefix highlighting incl. hub children).
New `/coach` hub gathers AI Examiner, AI Mentor, Averna AI, Essay X-Ray, Roleplay, Learning DNA, Speaking partner and 1-on-1 tutoring; the phone tab bar is Home · Skills · Practice · Coach · Me.
Pages that left the sidebar are linked from their hub (Studio, Learning Center, Speaking, Calendar, Profile, Inbox) and found in ⌘K by name or synonym; "New" badges expire on `NEW_BADGE_UNTIL`.

Not in scope now: 4 (personal mistake deck) and 6 (Telegram Mini App — to be discussed separately with the owner).

## Shared principles

- Phone first, desktop comfortable.
- Phone tap targets ≥ 44 px; body text ≥ 14 px; no text smaller than 11 px.
- Light and dark themes through design tokens only.
- No new per-route function config (`maxDuration`, `preferredRegion`, `memory`).
- Every existing route keeps working.
- Student UI in English (native-language hints are optional secondary text); admin UI stays Uzbek.
- One commit per idea.
