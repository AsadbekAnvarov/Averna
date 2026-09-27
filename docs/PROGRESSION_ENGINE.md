# Progression Engine

This is the one system that decides XP, levels, streaks, Daily Missions, challenges, milestone badges and "what next" recommendations. The code lives in `lib/engine/progression/`.

| File | Role |
|---|---|
| `config.ts` | **All balancing values**: `XP_CONFIG`, `LEVEL_THRESHOLDS` / `LEVEL_TIERS`, `STREAK_CONFIG`, `MISSION_CONFIG`, `DAILY_CHALLENGES` / `WEEKLY_CHALLENGES`, `BADGES` |
| `xp.ts` | Pure XP calculators for objective tests, writing, speaking, the daily quiz, SRS and homework, plus `estimateXp` |
| `levels.ts`, `streak.ts`, `skills.ts`, `missions.ts`, `challenges.ts`, `badges.ts`, `recommendations.ts` | Pure rule modules |
| `service.ts` | The DB layer: `loadXpHistory`, `getProgression` (request-cached, settles rewards), `settleProgression`, `buildSessionOutcome`, `getActivityHistory` |

The only code that writes `Student.totalPoints` is `lib/engine/xp-engine.ts` (`awardXp`). The UI never computes XP. It only displays what the engine returns.

## XP pipeline

The first step depends on the activity:

- **Reading / Listening:** questions × per-item XP
- **Writing:** a task base × a length factor (words ÷ IELTS target)^1.5
- **Speaking:** a base × duration

Every activity then goes through the same steps:

1. A quality multiplier: accuracy for Reading/Listening, band for Writing/Speaking.
2. Completion and difficulty.
3. Bonuses: first attempt, beating your recent average, a new personal best.
4. Repeat decay for the same content (×1, ×0.5, ×0.3, ×0.2, never below ×0.15).
5. Low-accuracy attempts are halved once a student has already made two in the same skill that day.
6. Variety: after 4 sessions of the same skill in one day, further sessions pay ×0.6.
7. The integrity trust multiplier.
8. A daily budget taper: full XP up to 450, ×0.5 up to 800, ×0.2 above that.

Each step is saved as a breakdown line in the ledger. Students see these lines under "Why this XP?".

## Reliability

`xp_transactions` has a unique `(studentId, idempotencyKey)` index. The ledger row, the `totalPoints` increment and, for tests, the `IELTSTest` row are committed in one transaction. Retries, double clicks and refreshes reuse the same key, so the database rejects the second award. The table is created by `prisma/sql/deploy.sql`, which is additive only.

## Retuning

Change the numbers in `config.ts`. To check the result, compile the pure modules and run them with Node. They have no dependencies:

```bash
tsc --ignoreConfig --outDir /tmp/pe --module commonjs --target es2020 lib/engine/progression/{config,xp,levels}.ts
node -e "const x=require('/tmp/pe/xp'); console.log(x.estimateXp('writingTask2'))"
```

Keep `LEVEL_THRESHOLDS` monotonic. If you raise thresholds, existing students can drop a level and lose level-gated rewards (`Reward.minLevel`).
