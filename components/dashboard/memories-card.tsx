"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ChevronRight } from "lucide-react";
import type { Memory } from "@/lib/memories";

/**
 * F9 — Memories. A quiet, elegant card that resurfaces a real moment from the
 * student's own journey (from getMemories). Shows the most meaningful memory
 * first; if there are several, the student can gently step through them like
 * scrolling back through their progress. Never intrusive.
 */
export function MemoriesCard({ memories }: { memories: Memory[] }) {
  const [i, setI] = useState(0);
  if (memories.length === 0) return null;

  const idx = i % memories.length;
  const m = memories[idx];
  const multiple = memories.length > 1;

  return (
    <Card className="glass border-white/10 relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.accent} to-transparent opacity-60 transition-all duration-700`} />
      <CardContent className="relative py-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-300">
            <Heart className="h-3.5 w-3.5 text-averna-pink" /> A moment from your journey
          </span>
          {multiple && (
            <div className="flex gap-1">
              {memories.map((_, k) => (
                <span
                  key={k}
                  className={`h-1.5 rounded-full transition-all ${k === idx ? "w-4 bg-white" : "w-1.5 bg-white/30"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div key={m.id} className="animate-fade-in flex items-start gap-3">
          <div className="text-3xl shrink-0">{m.emoji}</div>
          <div className="min-w-0">
            <p className="text-white font-semibold">{m.title}</p>
            <p className="text-sm text-gray-200 mt-0.5">{m.body}</p>
          </div>
        </div>

        {multiple && (
          <button
            onClick={() => setI((c) => c + 1)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
          >
            Next memory <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
