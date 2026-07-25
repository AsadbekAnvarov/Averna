"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Human-friendly "time since last refresh" — rolls up seconds into m/h/d. */
function formatAgo(totalSeconds: number): string {
  if (totalSeconds < 2) return "updated just now";
  if (totalSeconds < 60) return `updated ${totalSeconds}s ago`;
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s ? `updated ${m}m ${s}s ago` : `updated ${m}m ago`;
  }
  if (totalSeconds < 86400) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return m ? `updated ${h}h ${m}m ago` : `updated ${h}h ago`;
  }
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  return h ? `updated ${d}d ${h}h ago` : `updated ${d}d ago`;
}

/**
 * Shows a small "Live · updated ... ago" pill. It does NOT refresh the page on
 * its own — an automatic interval refresh was disruptive (it re-ran server
 * components while the user was mid-action). The page only updates when the
 * user clicks the pill (manual router.refresh). The pulsing dot keeps the live
 * feel, and the "updated ... ago" counter (formatAgo) signals staleness.
 *
 * `intervalMs` is accepted for backwards compatibility but intentionally unused.
 */
export function LiveRefresh({ label = "Live" }: { intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [spinning, setSpinning] = useState(false);

  // Only track how long ago the data was last loaded/refreshed — no auto-refresh.
  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const manual = () => {
    setSpinning(true);
    router.refresh();
    setSecondsAgo(0);
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <button
      onClick={manual}
      title="Click to refresh"
      className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-averna-neon opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-averna-neon" />
      </span>
      <span>{label}</span>
      <span className="text-gray-600">·</span>
      <span>{formatAgo(secondsAgo)}</span>
      <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
