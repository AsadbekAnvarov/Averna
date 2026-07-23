"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { MemoryEntry, MemoryStatus } from "@/lib/student-intel";

const STATUS_META: Record<MemoryStatus, { label: string; color: string; ring: string; chip: string }> = {
  mastered: { label: "Mastered", color: "text-averna-neon", ring: "#00ff94", chip: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" },
  strong: { label: "Strong", color: "text-averna-cyan", ring: "#00e5ff", chip: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan" },
  fading: { label: "Fading", color: "text-amber-400", ring: "#fbbf24", chip: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  forgotten: { label: "Needs review", color: "text-red-300", ring: "#f87171", chip: "border-red-500/40 bg-red-500/10 text-red-300" },
};

function Row({ entry, index }: { entry: MemoryEntry; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const meta = STATUS_META[entry.status];
  const reviewText =
    entry.nextReviewDays === 0 ? "Review now" : `Next review in ${entry.nextReviewDays} day${entry.nextReviewDays === 1 ? "" : "s"}`;

  return (
    <div
      ref={ref}
      className="relative pl-8 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* timeline spine dot */}
      <span className="absolute left-2 top-2 h-3 w-3 rounded-full ring-4 ring-black/20" style={{ background: meta.ring }} />

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{entry.label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.chip}`}>{meta.label}</span>
        </div>

        {/* retention */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${entry.retention}%`, background: meta.ring }} />
          </div>
          <span className={`text-xs font-bold ${meta.color}`}>{entry.retention}%</span>
        </div>

        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          You first learned this {entry.firstDaysAgo} day{entry.firstDaysAgo === 1 ? "" : "s"} ago
          {entry.sessions > 1 ? ` and revisited it ${entry.sessions - 1} time${entry.sessions - 1 === 1 ? "" : "s"}` : ""}.
          {" "}Long-term retention is {entry.retention}%.
        </p>

        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${entry.nextReviewDays === 0 ? "text-red-300" : "text-averna-cyan"}`}>
            {entry.nextReviewDays === 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {reviewText}
          </span>
          <span className="text-gray-500">last studied {entry.lastDaysAgo}d ago</span>
        </div>
      </div>
    </div>
  );
}

/**
 * F1 — Memory Timeline. A forgetting-curve view of each skill: how strong the
 * memory is now, when it was learned, and when to review next. Rows reveal as
 * you scroll. Data is computed server-side from real test history.
 */
export function MemoryTimeline({ entries }: { entries: MemoryEntry[] }) {
  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-neon">
          <Brain className="h-5 w-5" /> Memory Timeline
        </CardTitle>
        <p className="text-xs text-gray-400">How well each skill is holding in your memory — and when to review</p>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-3">
          {/* spine */}
          <span className="absolute left-[13px] top-1 bottom-1 w-px bg-white/10" />
          {entries.map((e, i) => (
            <Row key={e.key} entry={e} index={i} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" />
          Reviewing just before you forget is the fastest way to make knowledge permanent.
        </p>
      </CardContent>
    </Card>
  );
}
