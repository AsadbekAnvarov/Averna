# Averna CDI practice workspace

- Retired Averna originals are absent from Reading, Listening, Writing and Speaking libraries and new Mock allocation. Existing attempt/history resolvers retain them; no records or results are deleted.
- Published imported content retains its `imported` provenance, with the user-facing label **Averna CDI**. Catalogue cache keys are versioned to prevent old seed listings.
- Reading cards explicitly open Passage 1/2/3 independently using fresh attempt IDs, original question numbers and a 20-minute practice clock. Practice scope links are hidden in homework and all Mock modes. Mock runners ignore any partial-scope prop.
- Writing Task 1 and Task 2 remain separately selectable and use the shared split-screen workspace. Existing draft/account privacy, homework validation and idempotent submission are preserved. Full Mock still requires both tasks.
- Supplied Listening recordings remain uncut. Part-question navigation is available during the full recording; independent part playback is not advertised without verified timing boundaries. No substitute speech generation or guessed audio cuts.
- Speaking entry points lead to teacher-conducted practice. CDI samples stay examiner resources; no invented full Speaking tests or AI grading.
- Exam canvas follows the existing persisted light/dark preference. It has a neutral blue palette, independent panes, visible timer, font controls, highlight tools, answer status, review flags, question navigation and a keyboard-resizable divider. It is an Averna familiarisation workspace, not an official IELTS product or pixel-identical replica.

## Validation

- 472 unit/property/API tests across 60 suites passed; TypeScript, ESLint and production build passed.
- Local Chromium: 11 CDI practice/catalog/teacher-entry cases, 21 existing Mock cases and 4 preference/highlight regression cases passed.
- Passage 2 keeps questions 14–26 and a 20-minute practice clock. An adversarial `partIndex=1` in Mock still has all 40 questions, three passages and the 60-minute clock.
- Separate Writing tasks restore their text after refresh, retain per-user local/account drafts, disable browser spellcheck/dictation, and use task-specific word-count review copy.
- Desktop/mobile light and dark layouts were rendered and visually inspected; no production database changes are part of this update.
