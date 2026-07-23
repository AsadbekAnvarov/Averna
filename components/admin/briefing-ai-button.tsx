"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { tashkentDateKey } from "@/lib/utils";

const CACHE_KEY = "averna_admin_briefing_v1";

/**
 * Optional AI deepening of the executive briefing. The dashboard already shows
 * a fast, rule-based Uzbek briefing server-side; this button fetches a richer
 * GPT-4o narrative on demand (cached per day) so page loads stay fast and free.
 * Uzbek UI (admin language).
 */
export function BriefingAiButton() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    const today = tashkentDateKey();
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.date === today && parsed?.summary) {
          setSummary(parsed.summary);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/briefing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      setSummary(data.summary);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, summary: data.summary }));
      } catch {
        /* ignore */
      }
    } catch {
      setSummary("AI tahlilini hozir olib boʻlmadi. Yuqoridagi xulosadan foydalaning.");
    } finally {
      setLoading(false);
    }
  };

  if (summary) {
    return (
      <div className="mt-3 rounded-xl border border-averna-neon/30 bg-averna-neon/5 p-3">
        <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> AI tahlili
        </p>
        <p className="text-sm text-gray-200 leading-relaxed">{summary}</p>
      </div>
    );
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-averna-neon/40 bg-averna-neon/10 px-3 py-1.5 text-sm text-averna-neon hover:bg-averna-neon/20 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {loading ? "Tahlil qilinmoqda…" : "AI bilan chuqurroq tahlil"}
    </button>
  );
}
