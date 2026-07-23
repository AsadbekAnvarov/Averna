/**
 * Cosmetics catalog + fair random grant. Pure module (no DB / no client-only
 * APIs) so it can be imported by both the API route and client components.
 * Cosmetics are purely decorative — they never affect grades, points or ranks.
 */

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Cosmetic {
  id: string;
  name: string;
  emoji: string;
  type: string;
  rarity: Rarity;
}

export const COSMETICS: Cosmetic[] = [
  { id: "badge-star", name: "Starter Star", emoji: "⭐", type: "Badge", rarity: "common" },
  { id: "title-rising", name: "“Rising Learner”", emoji: "🌱", type: "Title", rarity: "common" },
  { id: "badge-owl", name: "Night Owl", emoji: "🦉", type: "Badge", rarity: "common" },
  { id: "badge-bee", name: "Busy Bee", emoji: "🐝", type: "Badge", rarity: "common" },
  { id: "title-focused", name: "“Focused”", emoji: "🎯", type: "Title", rarity: "common" },
  { id: "sticker-book", name: "Bookworm Sticker", emoji: "📗", type: "Sticker", rarity: "common" },
  { id: "frame-cyan", name: "Cyan Halo Frame", emoji: "🔷", type: "Frame", rarity: "rare" },
  { id: "frame-pink", name: "Neon Pink Frame", emoji: "🔶", type: "Frame", rarity: "rare" },
  { id: "accent-aurora", name: "Aurora Accent", emoji: "🌈", type: "Theme", rarity: "rare" },
  { id: "badge-flame", name: "Streak Flame", emoji: "🔥", type: "Badge", rarity: "rare" },
  { id: "avatar-astro", name: "Astro Avatar", emoji: "🧑‍🚀", type: "Avatar", rarity: "epic" },
  { id: "avatar-fox", name: "Mystic Fox", emoji: "🦊", type: "Avatar", rarity: "epic" },
  { id: "effect-confetti", name: "Confetti Aura", emoji: "🎉", type: "Effect", rarity: "epic" },
  { id: "crown-gold", name: "Golden Crown", emoji: "👑", type: "Legendary", rarity: "legendary" },
  { id: "dragon", name: "Averna Dragon", emoji: "🐉", type: "Legendary", rarity: "legendary" },
];

export const RARITY_META: Record<Rarity, { label: string; weight: number; ring: string; particles: number }> = {
  common: { label: "Common", weight: 60, ring: "#94a3b8", particles: 80 },
  rare: { label: "Rare", weight: 28, ring: "#22d3ee", particles: 120 },
  epic: { label: "Epic", weight: 10, ring: "#a78bfa", particles: 160 },
  legendary: { label: "Legendary", weight: 2, ring: "#fbbf24", particles: 220 },
};

export function cosmeticById(id: string | null | undefined): Cosmetic | null {
  if (!id) return null;
  return COSMETICS.find((c) => c.id === id) ?? null;
}

function pickRarity(): Rarity {
  const total = Object.values(RARITY_META).reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const key of ["legendary", "epic", "rare", "common"] as Rarity[]) {
    roll -= RARITY_META[key].weight;
    if (roll <= 0) return key;
  }
  return "common";
}

/** Fair random grant — prefers an item the student doesn't own yet. */
export function grantCosmetic(owned: string[]): { reward: Cosmetic; duplicate: boolean } {
  const rarity = pickRarity();
  const inRarity = COSMETICS.filter((c) => c.rarity === rarity);
  const fresh = inRarity.filter((c) => !owned.includes(c.id));
  const set = fresh.length ? fresh : inRarity;
  const reward = set[Math.floor(Math.random() * set.length)];
  return { reward, duplicate: owned.includes(reward.id) };
}
