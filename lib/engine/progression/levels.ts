/**
 * Level rules — pure. Turns total XP into a level, a meaningful tier and the
 * progress toward the next level. `getLevelInfo` in lib/utils delegates here,
 * so every surface (hero, profile, rewards gate, certificate) agrees.
 */

import { LEVEL_THRESHOLDS, LEVEL_TIERS, type TierConfig } from "./config";

export interface LevelInfo {
  level: number;
  /** Display title, e.g. "Builder II" or "Elite". */
  title: string;
  /** XP where this level starts / where the next level starts. */
  base: number;
  next: number;
  /** Percent progress into the current level (0-100). */
  into: number;
  isMax: boolean;
  /** XP still needed for the next level (0 at max). */
  toNext: number;
  tier: TierConfig;
  /** 1-based position of the tier (1 = Starter … 8 = Elite). */
  tierIndex: number;
  /** The next tier, when the student is not in the last one. */
  nextTier: TierConfig | null;
  /** First level of the next tier (null at the last tier). */
  nextTierLevel: number | null;
}

const ROMAN = ["I", "II", "III", "IV", "V"];

export function tierForLevel(level: number): { tier: TierConfig; index: number } {
  const idx = LEVEL_TIERS.findIndex((t) => t.levels.includes(level));
  const i = idx >= 0 ? idx : LEVEL_TIERS.length - 1;
  return { tier: LEVEL_TIERS[i], index: i };
}

export function levelTitle(level: number): string {
  const { tier } = tierForLevel(level);
  if (tier.levels.length <= 1) return tier.name;
  const pos = tier.levels.indexOf(level);
  return `${tier.name} ${ROMAN[Math.max(0, pos)] ?? ""}`.trim();
}

export function getLevelInfo(points: number): LevelInfo {
  const p = Math.max(0, Number(points) || 0);
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (p >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const idx = level - 1;
  const isMax = level >= LEVEL_THRESHOLDS.length;
  const base = LEVEL_THRESHOLDS[idx] ?? 0;
  const next = isMax ? base : LEVEL_THRESHOLDS[idx + 1];
  const into = isMax || next <= base ? 100 : Math.min(100, Math.round(((p - base) / (next - base)) * 100));
  const { tier, index } = tierForLevel(level);
  const nextTier = LEVEL_TIERS[index + 1] ?? null;
  return {
    level,
    title: levelTitle(level),
    base,
    next,
    into,
    isMax,
    toNext: isMax ? 0 : Math.max(0, next - p),
    tier,
    tierIndex: index + 1,
    nextTier,
    nextTierLevel: nextTier ? nextTier.levels[0] : null,
  };
}

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;
