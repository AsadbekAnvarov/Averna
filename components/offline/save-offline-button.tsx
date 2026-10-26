"use client";

import { useEffect, useState } from "react";
import { Check, CloudDownload, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { OFFLINE_EVENT } from "@/lib/offline/constants";
import { formatBytes } from "@/lib/offline/storage-cap";
import { getPack, offlineSupported, type SaveResult } from "@/lib/offline/store";
import { useOnline, useUserId } from "./use-offline";

type Props = {
  packId: string;
  /** e.g. "Save for offline", "Save my due cards". */
  label?: string;
  /** Size shown before saving ("≈" when estimated). */
  bytes?: number | null;
  estimated?: boolean;
  /** Why this can't be saved (shown instead of the button, honestly). */
  unavailable?: string | null;
  onSave: (ownerId: string) => Promise<SaveResult>;
  className?: string;
  /** One 44 px icon button (tight bars such as the interactive lesson's); errors go to a toast. */
  compact?: boolean;
};

/**
 * "Save for offline" (idea 7): saves a pack on this device for the signed-in user, shows its
 * size first, then "Saved for offline · Open". 44 px tall on phones. Renders nothing where
 * the browser can't keep packs (no IndexedDB / service worker).
 */
export function SaveOfflineButton({ packId, label = "Save for offline", bytes, estimated, unavailable, onSave, className, compact }: Props) {
  const userId = useUserId();
  const online = useOnline();
  const [supported, setSupported] = useState(false);
  const [saved, setSaved] = useState<{ bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setSupported(offlineSupported()), []);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    const check = () =>
      void getPack(packId).then((p) => {
        if (alive) setSaved(p && p.ownerId === userId ? { bytes: p.bytes } : null);
      });
    check();
    window.addEventListener(OFFLINE_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(OFFLINE_EVENT, check);
    };
  }, [packId, supported, userId]);

  if (!supported || !userId) return null;

  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 sm:min-h-10";

  if (unavailable && !saved) {
    return (
      <p className={cn("flex items-start gap-2 text-sm text-gray-400", className)}>
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{unavailable}</span>
      </p>
    );
  }

  const save = async () => {
    setBusy(true);
    setError("");
    const result = await onSave(userId);
    setBusy(false);
    if (result.ok) {
      setSaved({ bytes: result.pack.bytes });
      toast.success(`Saved for offline · ${formatBytes(result.pack.bytes)}`, {
        action: { label: "Open", onClick: () => window.location.assign("/offline") },
      });
    } else if (compact) {
      toast.error(result.message);
    } else {
      setError(result.message);
    }
  };

  const size = typeof bytes === "number" && bytes > 0 ? `${estimated ? "≈ " : ""}${formatBytes(bytes)}` : null;

  if (compact) {
    const square = "inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
    return saved ? (
      <a href="/offline" aria-label={`Saved for offline (${formatBytes(saved.bytes)}). Open the offline library`} title="Saved for offline" className={cn(square, "text-averna-neon", className)}>
        <Check className="h-5 w-5" aria-hidden />
      </a>
    ) : (
      <button
        type="button"
        onClick={save}
        disabled={busy || !online}
        aria-label={online ? `${label}${size ? ` (${size})` : ""}` : "Connect to save for offline"}
        title={label}
        className={cn(square, "text-averna-cyan hover:bg-averna-cyan/10 disabled:opacity-60", className)}
      >
        {busy ? <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden /> : <CloudDownload className="h-5 w-5" aria-hidden />}
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <>
            <span className={cn(base, "border-averna-neon/30 bg-averna-neon/[0.08] text-averna-neon")}>
              <Check className="h-4 w-4" aria-hidden /> Saved for offline · {formatBytes(saved.bytes)}
            </span>
            {/* A full page load: works offline too (the worker serves the saved /offline page). */}
            <a href="/offline" className={cn(base, "border-white/10 text-gray-200 hover:border-white/20 hover:text-white")}>
              Open offline library
            </a>
            {online && (
              <button type="button" onClick={save} disabled={busy} className={cn(base, "border-white/10 text-gray-300 hover:text-white disabled:opacity-60")}>
                {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <CloudDownload className="h-4 w-4" aria-hidden />}
                Update
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={busy || !online}
            className={cn(base, "border-averna-cyan/40 text-averna-cyan hover:bg-averna-cyan/10 disabled:opacity-60")}
          >
            {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <CloudDownload className="h-4 w-4" aria-hidden />}
            {busy ? "Saving…" : online ? label : "Connect to save for offline"}
            {size && !busy && online && <span className="text-xs font-normal text-gray-400">{size}</span>}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className={cn("text-sm text-red-300", !error && "sr-only")}>
        {error}
      </p>
    </div>
  );
}
