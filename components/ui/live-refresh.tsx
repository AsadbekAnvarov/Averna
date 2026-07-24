"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Shows a small "Live · updated Xs ago" pill. It does NOT refresh the page on
 * its own — an automatic interval refresh was disruptive (it re-ran server
 * components while the user was mid-action). The page only updates when the
 * user clicks the pill (manual router.refresh). The pulsing dot keeps the live
 * feel, and the "updated Xs ago" counter signals when data may be stale.
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
      <span>{secondsAgo < 2 ? "updated just now" : `updated ${secondsAgo}s ago`}</span>
      <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
