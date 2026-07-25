"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Sparkles, Lock, Star, Loader2 } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { COSMETICS, RARITY_META, cosmeticById, type Cosmetic } from "@/lib/cosmetics";

/**
 * F4 — Mystery Rewards (server-backed). A daily surprise box granting
 * purely-cosmetic collectibles across rarity tiers, with a reveal animation +
 * confetti. Owned items, the featured pick and the daily gate all persist
 * server-side (so they follow the student across devices). Cosmetic only —
 * never affects grades, points or ranks.
 */
export function MysteryBox() {
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<string[]>([]);
  const [featured, setFeatured] = useState<string | null>(null);
  const [canOpen, setCanOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed">("idle");
  const [reward, setReward] = useState<Cosmetic | null>(null);
  const [dup, setDup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cosmetics");
        const data = await res.json();
        if (res.ok) {
          setOwned(data.owned ?? []);
          setFeatured(data.featured ?? null);
          setCanOpen(!!data.canOpen);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openBox = async () => {
    if (phase !== "idle" || !canOpen) return;
    setPhase("opening");
    try {
      const res = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCanOpen(false);
        setPhase("idle");
        return;
      }
      setReward(data.reward);
      setDup(!!data.duplicate);
      setOwned(data.owned ?? owned);
      setCanOpen(false);
      setPhase("revealed");
      fireConfetti({ particles: RARITY_META[data.reward.rarity as Cosmetic["rarity"]].particles, duration: 2400 });
    } catch {
      setPhase("idle");
    }
  };

  const toggleFeatured = async (id: string) => {
    const next = featured === id ? null : id;
    setFeatured(next); // optimistic
    try {
      await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feature", id }),
      });
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <Card className="glass border-averna-pink/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-pink">
            <Gift className="h-5 w-5" /> Mystery Box
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-averna-pink" />
        </CardContent>
      </Card>
    );
  }

  const openedToday = !canOpen && phase === "idle";

  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-averna-pink/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-pink">
          <span className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Mystery Box
          </span>
          <span className="text-xs font-normal text-gray-400">{owned.length}/{COSMETICS.length} collected</span>
        </CardTitle>
        <p className="text-xs text-gray-400">A daily surprise — cosmetic only, just for fun ✨</p>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <div className="text-center py-2">
          {phase === "revealed" && reward ? (
            <div className="animate-fade-in">
              <div className="text-6xl mb-2 select-none" style={{ filter: `drop-shadow(0 0 16px ${RARITY_META[reward.rarity].ring})` }}>
                {reward.emoji}
              </div>
              <p className="text-lg font-bold text-white">{reward.name}</p>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-gray-300">
                {reward.type} · {RARITY_META[reward.rarity].label}
              </span>
              <p className="text-xs text-gray-400 mt-2">{dup ? "Duplicate — added a little shine ✨" : "Added to your collection! 🎉"}</p>
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

        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Your collection</p>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {COSMETICS.map((r) => {
              const isOwned = owned.includes(r.id);
              const isFeatured = featured === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => isOwned && toggleFeatured(r.id)}
                  title={isOwned ? `${r.name} — ${RARITY_META[r.rarity].label}${isFeatured ? " (featured)" : " (tap to feature)"}` : "Locked"}
                  className={`relative aspect-square rounded-lg border flex items-center justify-center text-xl transition-all ${
                    isOwned ? "bg-white/5 hover:scale-105" : "bg-white/[0.02] cursor-default"
                  }`}
                  style={{ borderColor: isOwned ? `${RARITY_META[r.rarity].ring}66` : "rgba(255,255,255,0.06)" }}
                >
                  {isOwned ? (
                    <span style={{ filter: `drop-shadow(0 0 6px ${RARITY_META[r.rarity].ring}55)` }}>{r.emoji}</span>
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-gray-600" />
                  )}
                  {isFeatured && <Star className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                </button>
              );
            })}
          </div>
          {featured && (
            <p className="mt-2 text-[11px] text-averna-pink">
              Featured: {cosmeticById(featured)?.emoji} {cosmeticById(featured)?.name} — shown on your profile
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
