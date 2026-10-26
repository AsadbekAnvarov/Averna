"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CloudOff, RefreshCw, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pendingCount } from "@/lib/offline/queue-store";
import { ensureOwner, readOwner } from "@/lib/offline/store";
import { syncReviews } from "@/lib/offline/sync";

type Phase = "hidden" | "offline" | "syncing" | "synced" | "back" | "failed";

const plural = (n: number) => `${n} ${n === 1 ? "review" : "reviews"}`;

/**
 * A calm connection line (idea 7). Offline: "You're offline — saved lessons still work ·
 * Open". Back online: "Back online · syncing N reviews…", then "N reviews synced". Mounted
 * once in the app shell, above the phone tab bar (never over it) and below drawers and
 * full-screen lessons. Announced politely.
 *
 * It also keeps the device's offline data with its owner: another signed-in user wipes the
 * previous user's packs, and waiting grades sync on load and when the connection returns.
 */
export function ConnectionIndicator() {
  const pathname = usePathname() || "";
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? ((session?.user as { id?: string } | undefined)?.id ?? null) : null;
  const ownerRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [count, setCount] = useState(0);
  const hideTimer = useRef<number | undefined>(undefined);

  ownerRef.current = userId ?? (typeof window !== "undefined" ? readOwner() : null);

  const hideLater = (ms: number) => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPhase("hidden"), ms);
  };

  // Signed in: the packs belong to this user (or are wiped), and waiting grades go out.
  useEffect(() => {
    if (!userId) return;
    void ensureOwner(userId).then(() => {
      if (navigator.onLine !== false && pendingCount(userId) > 0) void syncReviews(userId);
    });
  }, [userId]);

  useEffect(() => {
    const goOffline = () => {
      window.clearTimeout(hideTimer.current);
      setPhase("offline");
    };
    const goOnline = () => {
      const owner = ownerRef.current;
      const waiting = pendingCount(owner);
      if (!owner || waiting === 0) {
        setPhase("back");
        hideLater(3000);
        return;
      }
      setCount(waiting);
      setPhase("syncing");
      void syncReviews(owner).then((outcome) => {
        if (outcome.failure) {
          setCount(outcome.pending);
          setPhase("failed");
          hideLater(6000);
        } else {
          setCount(outcome.synced);
          setPhase("synced");
          hideLater(4000);
        }
      });
    };
    if (navigator.onLine === false) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  const onOfflinePage = pathname === "/offline";
  const text =
    phase === "offline"
      ? "You're offline — saved lessons still work"
      : phase === "syncing"
        ? `Back online · syncing ${plural(count)}…`
        : phase === "synced"
          ? `Back online · ${plural(count)} synced`
          : phase === "failed"
            ? `Back online · ${plural(count)} will sync later`
            : phase === "back"
              ? "Back online"
              : "";
  const Icon = phase === "offline" ? CloudOff : phase === "syncing" ? RefreshCw : Wifi;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4",
        // Above the phone tab bar (about 72 px + safe area, whatever the text size) and clear of the desktop rail.
        "bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:pl-64"
      )}
    >
      {phase !== "hidden" && (
        <div
          data-testid="connection-indicator"
          className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/10 glass-strong py-1 pl-3 pr-1 text-sm text-gray-100 shadow-lg animate-fade-in"
        >
          <Icon className={cn("h-4 w-4 shrink-0", phase === "offline" ? "text-amber-300" : "text-averna-neon", phase === "syncing" && "motion-safe:animate-spin")} aria-hidden />
          <span className="min-w-0 truncate py-2">{text}</span>
          {phase === "offline" && !onOfflinePage && (
            // A full page load, so the worker can serve the saved /offline page.
            <a href="/offline" className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold text-averna-cyan hover:underline sm:min-h-9">
              Open
            </a>
          )}
          <button
            type="button"
            onClick={() => setPhase("hidden")}
            aria-label="Dismiss connection status"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-white sm:h-9 sm:w-9"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
