/**
 * Offline packs on this device (idea 7). Browser only.
 *
 * Records live in IndexedDB (lib/offline/idb.ts); their files (interactive lesson HTML,
 * recordings) in the packs cache. Everything is tagged with the user who saved it: another
 * user signing in on the device wipes it (ensureOwner), and so does signing out
 * (wipeOfflineData, called by every sign-out button before it signs out).
 */
import { OFFLINE_OWNER_KEY, OFFLINE_PACKS_CACHE, OFFLINE_SHELL_CACHE } from "./constants";
import { idbAvailable, idbDelete, idbDeleteDatabase, idbGet, idbGetAll, idbPut } from "./idb";
import { isPack, jsonBytes, type OfflinePack } from "./packs";
import { clearQueue, loadQueue, notifyOffline } from "./queue-store";
import { checkSave, formatBytes, totalBytes } from "./storage-cap";
import { forgetSignedInUser, syncReviews } from "./sync";

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && idbAvailable() && "caches" in window && "serviceWorker" in navigator;
}

export function readOwner(): string | null {
  try {
    return localStorage.getItem(OFFLINE_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(id: string | null): void {
  try {
    if (id) localStorage.setItem(OFFLINE_OWNER_KEY, id);
    else localStorage.removeItem(OFFLINE_OWNER_KEY);
  } catch {
    /* blocked storage */
  }
}

/** This device's packs for `ownerId` (default: the user who saved them), newest first. */
export async function listPacks(ownerId?: string | null): Promise<OfflinePack[]> {
  if (!idbAvailable()) return [];
  const owner = ownerId ?? readOwner();
  if (!owner) return [];
  const all = await idbGetAll().catch(() => [] as unknown[]);
  return all.filter(isPack).filter((p) => p.ownerId === owner).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getPack(id: string): Promise<OfflinePack | null> {
  if (!idbAvailable()) return null;
  const value = await idbGet(id).catch(() => null);
  return isPack(value) && value.ownerId === readOwner() ? value : null;
}

export async function storageEstimate(): Promise<{ quota?: number; usage?: number; persisted?: boolean }> {
  try {
    const storage = navigator.storage;
    if (!storage?.estimate) return {};
    const [estimate, persisted] = await Promise.all([storage.estimate(), storage.persisted?.().catch(() => false)]);
    return { quota: estimate.quota, usage: estimate.usage, persisted: !!persisted };
  } catch {
    return {};
  }
}

/** Asks the browser not to evict the packs (granted silently or not at all; never a prompt we rely on). */
async function requestPersist(): Promise<void> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return;
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Asks the service worker to keep the /offline page and its files (so saved packs open with no network). */
export async function cacheShell(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await withTimeout(navigator.serviceWorker.ready, 8_000, null);
  const worker = registration?.active;
  if (!worker) return false;
  return withTimeout(
    new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(!!(event.data as { ok?: boolean } | null)?.ok);
      worker.postMessage({ type: "CACHE_OFFLINE_SHELL" }, [channel.port2]);
    }),
    30_000,
    false,
  );
}

/** A file to keep with a pack: stored in the packs cache under `url`. */
export interface PackFile {
  url: string;
  blob: Blob;
}

export type SaveResult =
  | { ok: true; pack: OfflinePack }
  | { ok: false; reason: "unsupported" | "cap" | "quota" | "error"; message: string };

/**
 * Saves (or replaces) a pack and its files, within the 150 MB cap and the browser's quota.
 * `pack.bytes` is computed here. The first save also asks the worker to keep the /offline page.
 */
export async function savePack(pack: OfflinePack, files: PackFile[] = []): Promise<SaveResult> {
  if (!offlineSupported()) return { ok: false, reason: "unsupported", message: "This browser can't save lessons for offline use." };
  try {
    // Packs of another user never mix with this one's.
    const owner = readOwner();
    if (owner && owner !== pack.ownerId) await wipeOfflineData({ sync: false, keepQueue: true });

    const fileBytes = files.reduce((sum, f) => sum + f.blob.size, 0);
    const record = { ...pack, bytes: 0 } as OfflinePack;
    record.bytes = jsonBytes(record) + fileBytes;

    const existing = await listPacks(pack.ownerId);
    const replacing = existing.find((p) => p.id === pack.id)?.bytes ?? 0;
    const estimate = await storageEstimate();
    const check = checkSave({ usedBytes: totalBytes(existing), addBytes: record.bytes, replacingBytes: replacing, ...estimate });
    if (!check.ok) {
      return check.reason === "cap"
        ? { ok: false, reason: "cap", message: `Not enough room: offline lessons are limited to ${formatBytes(check.capBytes)}. Remove something in the offline library first.` }
        : { ok: false, reason: "quota", message: "This device is low on storage. Free some space, then try again." };
    }

    if (files.length) {
      const cache = await caches.open(OFFLINE_PACKS_CACHE);
      for (const f of files) {
        await cache.put(
          f.url,
          new Response(f.blob, { headers: { "Content-Type": f.blob.type || "application/octet-stream", "Content-Length": String(f.blob.size) } }),
        );
      }
    }
    await idbPut(record);
    writeOwner(pack.ownerId);
    notifyOffline();
    void requestPersist();
    // Keep the /offline page itself (refreshed on each save, so it matches the current build).
    void cacheShell();
    return { ok: true, pack: record };
  } catch {
    return { ok: false, reason: "error", message: "Couldn't save for offline. Try again." };
  }
}

/** The files a pack points at. */
function packFiles(pack: OfflinePack): string[] {
  if (pack.kind === "article" && pack.lesson) return [pack.lesson.file];
  if (pack.kind === "listening") return [pack.audio.file];
  return [];
}

/** Updates a pack's record only (e.g. its review state after studying offline). */
export async function updatePack(pack: OfflinePack): Promise<void> {
  if (pack.ownerId !== readOwner()) return;
  await idbPut(pack).catch(() => undefined);
  notifyOffline();
}

export async function readPackFile(url: string): Promise<Blob | null> {
  try {
    const hit = await caches.match(url, { cacheName: OFFLINE_PACKS_CACHE });
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

export async function removePack(id: string): Promise<void> {
  const pack = await getPack(id);
  if (pack) {
    const cache = await caches.open(OFFLINE_PACKS_CACHE).catch(() => null);
    for (const url of packFiles(pack)) await cache?.delete(url).catch(() => false);
  }
  await idbDelete(id).catch(() => undefined);
  notifyOffline();
}

/** "Remove all": every pack, its files and the saved /offline page. Waiting grades stay (they still sync). */
export async function removeAllPacks(): Promise<void> {
  await idbDeleteDatabase();
  if (typeof caches !== "undefined") {
    await caches.delete(OFFLINE_PACKS_CACHE).catch(() => false);
    await caches.delete(OFFLINE_SHELL_CACHE).catch(() => false);
  }
  notifyOffline();
}

/** Tells the worker to drop its private caches (packs, saved shell); resolves when it answered or after 2 s. */
function clearWorkerCaches(): Promise<void> {
  try {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return Promise.resolve();
    return withTimeout(
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        worker.postMessage({ type: "CLEAR_PRIVATE_CACHE" }, [channel.port2]);
      }),
      2_000,
      undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

/**
 * Sign-out: sends waiting grades when online (at most ~2.5 s), then wipes every pack, file,
 * the saved /offline page and the queue, and tells the worker to clear its private caches.
 * Never throws and never takes more than a few seconds.
 */
export async function wipeOfflineData(options: { sync?: boolean; keepQueue?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const owner = readOwner();
    if (options.sync !== false && owner && loadQueue().length && navigator.onLine !== false) {
      await withTimeout(syncReviews(owner).catch(() => null), 2_500, null);
    }
    await withTimeout(idbDeleteDatabase(), 2_000, undefined);
    if (typeof caches !== "undefined") {
      await Promise.all([caches.delete(OFFLINE_PACKS_CACHE).catch(() => false), caches.delete(OFFLINE_SHELL_CACHE).catch(() => false)]);
    }
    if (!options.keepQueue) clearQueue();
    writeOwner(null);
    forgetSignedInUser();
    await clearWorkerCaches();
  } catch {
    /* best effort: never block signing out */
  }
  notifyOffline();
}

/**
 * Another user is signed in than the one who saved the packs (the first never signed out):
 * wipe the packs. Their waiting grades stay tagged with their id and only sync for them.
 */
export async function ensureOwner(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const owner = readOwner();
  if (owner && owner !== userId) await wipeOfflineData({ sync: false, keepQueue: true });
}

/** Total bytes and count of this user's packs. */
export async function offlineUsage(ownerId?: string | null): Promise<{ bytes: number; count: number }> {
  const packs = await listPacks(ownerId);
  return { bytes: totalBytes(packs), count: packs.length };
}
