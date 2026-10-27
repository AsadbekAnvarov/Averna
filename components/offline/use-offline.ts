"use client";

import { useContext, useEffect, useState } from "react";
import { SessionContext } from "next-auth/react";
import { toast } from "@/components/ui/toast";
import { OFFLINE_EVENT } from "@/lib/offline/constants";
import { pendingCount } from "@/lib/offline/queue-store";
import { lastSyncFailure, syncReviews } from "@/lib/offline/sync";

/** navigator.onLine, kept current. True on the server and before mount. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** The signed-in user's id (null while loading, signed out or outside a SessionProvider). */
export function useUserId(): string | null {
  const session = useContext(SessionContext);
  return session?.status === "authenticated" ? ((session.data?.user as { id?: string } | undefined)?.id ?? null) : null;
}

/** This user's grades still waiting to sync, kept current. */
export function usePendingReviews(ownerId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(pendingCount(ownerId));
    update();
    window.addEventListener(OFFLINE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(OFFLINE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [ownerId]);
  return count;
}

export type SyncState = "offline" | "syncing" | "later" | null;

/**
 * Waiting grades and what is happening to them: "offline" (no connection, or the server
 * can't be reached), "syncing", "later" (the server refused for now) or null (none waiting).
 */
export function useSyncStatus(ownerId: string | null): { pending: number; state: SyncState } {
  const online = useOnline();
  const pending = usePendingReviews(ownerId);
  const [failure, setFailure] = useState(lastSyncFailure());
  useEffect(() => {
    const update = () => setFailure(lastSyncFailure());
    update();
    window.addEventListener(OFFLINE_EVENT, update);
    return () => window.removeEventListener(OFFLINE_EVENT, update);
  }, []);
  const state: SyncState = pending === 0 ? null : !online || failure === "offline" ? "offline" : failure === "server" ? "later" : "syncing";
  return { pending, state };
}

/** "Saved offline — 2 reviews will sync" and friends. */
export function syncLabel(pending: number, state: SyncState): string {
  const n = `${pending} ${pending === 1 ? "review" : "reviews"}`;
  return state === "offline" ? `Saved offline — ${n} will sync` : state === "later" ? `${n} will sync later` : state === "syncing" ? `Syncing ${n}…` : "";
}

let lastErrorToast = 0;

/**
 * Sends waiting grades without blocking the card. Offline: they simply wait (the queue
 * says "Saved offline — will sync"). A server error: one calm toast with Retry.
 */
export function syncInBackground(ownerId: string | null): void {
  if (!ownerId) return;
  void syncReviews(ownerId).then((outcome) => {
    if (outcome.failure !== "server" || Date.now() - lastErrorToast < 15_000) return;
    lastErrorToast = Date.now();
    toast.error("Couldn't save your review yet. It's kept on this device.", {
      action: { label: "Retry", onClick: () => syncInBackground(ownerId) },
      duration: 8000,
    });
  });
}
