"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Sparkles, Lock, Star } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { tashkentDateKey } from "@/lib/utils";

const STORAGE_KEY = "averna_mystery_v1";

type Rarity = "common" | "rare" | "epic" | "legendary";

interface Reward {
  id: string;
  name: string;
  emoji: string;
  type: string;
  rarity: Rarity;
}

const POOL: Reward[] = [
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

const RARITY: Record<Rarity, { label: string; weight: number; chip: string; ring: string; particles: number }> = {
  common: { label: "Common", weight: 60, chip: "border-gray-500/40 bg-gray-500/10 text-gray-300", ring: "#94a3b8", particles: 80 },
  rare: { label: "Rare", weight: 28, chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan", ring: "#22d3ee", particles: 120 },
  epic: { label: "Epic", weight: 10, chip: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple", ring: "#a78bfa", particles: 160 },
  legendary: { label: "Legendary", weight: 2, chip: "border-amber-400/50 bg-amber-400/10 text-amber-300", ring: "#fbbf24", particles: 220 },
};

interface Store {
  lastOpened: string;
  owned: string[];
  featured: string | null;
}

function pickRarity(): Rarity {
  const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const key of ["legendary", "epic", "rare", "common"] as Rarity[]) {
    roll -= RARITY[key].weight;
    if (roll <= 0) return key;
  }
  return "common";
}

function pickReward(owned: string[]): Reward {
  const rarity = pickRarity();
  const inRarity = POOL.filter((r) => r.rarity === rarity);
  const fresh = inRarity.filter((r) => !owned.includes(r.id));
  const set = fresh.length ? fresh : inRarity;
  return set[Math.floor(Math.random() * set.length)];
}

/**
 * F4 — Mystery Rewards. A daily surprise box granting purely-cosmetic
 * collectibles (badges, frames, avatars, effects) across rarity tiers, with a
 * reveal animation + confetti. Client-side (localStorage) — cosmetic only, never
 * affects grades or points, so it's fun without being unfair.
 */
export function MysteryBox() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<Store>({ lastOpened: "", owned: [], featured: null });
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed">("idle");
  const [reward, setReward] = useState<Reward | null>(null);
  const [dup, setDup] = useState(false);
  const today = tashkentDateKey();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStore(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const persist = (next: Store) => {
    setStore(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const openBox = () => {
    if (phase !== "idle") return;
    setPhase("opening");
    setTimeout(() => {
      const r = pickReward(store.owned);
      const isDup = store.owned.includes(r.id);
      setReward(r);
      setDup(isDup);
      setPhase("revealed");
      fireConfetti({ particles: RARITY[r.rarity].particles, duration: 2400 });
      const owned = isDup ? store.owned : [...store.owned, r.id];
      persist({ lastOpened: today, owned, featured: store.featured });
    }, 900);
  };

  const toggleFeatured = (id: string) => {
    persist({ ...store, featured: store.featured === id ? null : id });
  };

  if (!loaded) {
    return (
      <Card className="glass border-averna-pink/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-pink">
            <Gift className="h-5 w-5" /> Mystery Box
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32" />
      </Card>
    );
  }

  const openedToday = store.lastOpened === today && phase === "idle";
  const ownedCount = store.owned.length;

  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-averna-pink/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-pink">
          <span className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Mystery Box
          </span>
          <span className="text-xs font-normal text-gray-400">{ownedCount}/{POOL.length} collected</span>
        </CardTitle>
        <p className="text-xs text-gray-400">A daily surprise — cosmetic only, just for fun ✨</p>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {/* Box / reveal area */}
        <div className="text-center py-2">
          {phase === "revealed" && reward ? (
            <div className="animate-fade-in">
              <div className="text-6xl mb-2 select-none" style={{ filter: `drop-shadow(0 0 16px ${RARITY[reward.rarity].ring})` }}>
                {reward.emoji}
              </div>
              <p className="text-lg font-bold text-white">{reward.name}</p>
              <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${RARITY[reward.rarity].chip}`}>
                {reward.type} · {RARITY[reward.rarity].label}
              </span>
              <p className="text-xs text-gray-400 mt-2">
                {dup ? "Duplicate — added a little shine ✨" : "Added to your collection! 🎉"}
              </p>
            </div>
          ) : (
            <>
              <div className={`text-6xl mb-2 select-none ${phase === "opening" ? "animate-bounce" : "animate-pulse"}`}>🎁</div>
              {openedToday ? (
                <p className="text-sm text-gray-400">Today&apos;s box is open — come back tomorrow for another!</p>
              ) : (
                <button
                  onClick={openBox}
                  disabled={phase === "opening"}
                  className="mt-1 neon-button bg-averna-pink hover:bg-averna-pink/80 text-white px-6 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-70"
                >
                  <Sparkles className="h-4 w-4" /> {phase === "opening" ? "Opening…" : "Open today's box"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Collection */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Your collection</p>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {POOL.map((r) => {
              const owned = store.owned.includes(r.id);
              const featured = store.featured === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => owned && toggleFeatured(r.id)}
                  title={owned ? `${r.name} — ${RARITY[r.rarity].label}${featured ? " (featured)" : " (tap to feature)"}` : "Locked"}
                  className={`relative aspect-square rounded-lg border flex items-center justify-center text-xl transition-all ${
                    owned ? "bg-white/5 hover:scale-105" : "bg-white/[0.02] cursor-default"
                  }`}
                  style={{ borderColor: owned ? `${RARITY[r.rarity].ring}66` : "rgba(255,255,255,0.06)" }}
                >
                  {owned ? (
                    <span style={{ filter: `drop-shadow(0 0 6px ${RARITY[r.rarity].ring}55)` }}>{r.emoji}</span>
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-gray-600" />
                  )}
                  {featured && <Star className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                </button>
              );
            })}
          </div>
          {store.featured && (
            <p className="mt-2 text-[11px] text-averna-pink">
              Featured: {POOL.find((p) => p.id === store.featured)?.emoji} {POOL.find((p) => p.id === store.featured)?.name}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
