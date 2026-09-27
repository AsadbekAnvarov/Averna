/**
 * Milestone badges — pure. Every badge is derived from verified evidence
 * (tests, sessions, streak, missions), so it can't be faked; the service pays
 * each badge's small XP exactly once through the idempotent XP ledger, and the
 * ledger row's timestamp is the unlock time.
 */

import { BADGES, type BadgeDef, type BadgeMetric } from "./config";

export type BadgeSnapshot = Record<BadgeMetric, number>;

export interface BadgeState {
  def: BadgeDef;
  current: number;
  target: number;
  percent: number;
  earned: boolean;
  unlockedAt: number | null;
  rewardKey: string;
}

export const badgeRewardKey = (id: string) => `badge:${id}`;

export function evaluateBadges(snapshot: BadgeSnapshot, unlocked: Map<string, number>): BadgeState[] {
  return BADGES.map((def) => {
    const current = Math.max(0, snapshot[def.metric] ?? 0);
    const already = unlocked.get(def.id) ?? null;
    const earned = already != null || current >= def.target;
    return {
      def,
      current: Math.min(current, def.target),
      target: def.target,
      percent: Math.min(100, Math.round((current / def.target) * 100)),
      earned,
      unlockedAt: already,
      rewardKey: badgeRewardKey(def.id),
    };
  });
}
