"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Quietly re-runs the server components on an interval (router.refresh) so live
 * widgets — activity feed, grading inbox, KPIs — stay fresh without a full
 * reload. Shows a tiny "updated Xs ago" pill the user can also click to refresh.
 */
export function LiveRefresh({ intervalMs = 30000, label = "Live" }: { intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSpinning(true);
      router.refresh();
      setSecondsAgo(0);
      setTimeout(() => setSpinning(false), 600);
    };

    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    const poll = setInterval(refresh, intervalMs);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router, intervalMs]);

  const manual = () => {
    setSpinning(true);
    router.refresh();
    setSecondsAgo(0);
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <button
      onClick={manual}
      title="Refresh now"
      className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-averna-neon opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-averna-neon" />
      </span>
      <span>{label}</span>
      <span className="text-gray-600">·</span>
      <span>{secondsAgo < 2 ? "updated just now" : `updated ${secondsAgo}s ago`}</span>
      <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
