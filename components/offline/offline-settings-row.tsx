"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, HardDrive } from "lucide-react";
import { OFFLINE_CAP_BYTES, OFFLINE_EVENT } from "@/lib/offline/constants";
import { formatBytes } from "@/lib/offline/storage-cap";
import { offlineUsage } from "@/lib/offline/store";

/** Settings → Account → "Offline library": what is saved on this device, and a link to it (idea 7). */
export function OfflineSettingsRow() {
  const [usage, setUsage] = useState<{ bytes: number; count: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void offlineUsage()
        .then((u) => alive && setUsage(u))
        .catch(() => alive && setUsage({ bytes: 0, count: 0 }));
    load();
    window.addEventListener(OFFLINE_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(OFFLINE_EVENT, load);
    };
  }, []);

  const desc =
    usage && usage.count > 0
      ? `${usage.count} saved · ${formatBytes(usage.bytes)} of ${formatBytes(OFFLINE_CAP_BYTES)} on this device`
      : "Save flashcards, articles and Listening parts to use without a connection";

  return (
    <Link href="/offline" className="flex items-center gap-4 p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-averna-primary/20 text-averna-neon">
        <HardDrive className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white text-sm">Offline library</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
    </Link>
  );
}
