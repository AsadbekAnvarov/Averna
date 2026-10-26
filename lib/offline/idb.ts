/**
 * A minimal promise wrapper over IndexedDB for the offline packs (idea 7): one database,
 * one object store keyed by `id`. No dependency. Browser only; every call rejects when
 * IndexedDB is unavailable (private modes, old browsers) so callers can say so.
 */
import { OFFLINE_DB, OFFLINE_DB_VERSION, OFFLINE_STORE } from "./constants";

let opening: Promise<IDBDatabase> | null = null;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openOfflineDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("IndexedDB is not available"));
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OFFLINE_STORE)) req.result.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab deletes the database on sign-out: let it, and reopen next time.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
    req.onblocked = () => {
      opening = null;
      reject(new Error("IndexedDB open blocked"));
    };
  });
  return opening;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOfflineDb();
  const tx = db.transaction(OFFLINE_STORE, mode);
  const result = request(run(tx.objectStore(OFFLINE_STORE)));
  result.catch(() => undefined); // the transaction's own error is what the caller sees
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
  return result;
}

/** True while the database is being deleted: reads answer "nothing saved" instead of reopening (and recreating) it. */
let deleting = false;

/**
 * Whether the database exists, without creating it (opening an IndexedDB database creates it,
 * so a read on a device that never saved anything would leave an empty one behind).
 */
async function dbExists(): Promise<boolean> {
  if (deleting) return false;
  if (opening) return true;
  if (typeof indexedDB.databases !== "function") return true;
  try {
    return (await indexedDB.databases()).some((d) => d.name === OFFLINE_DB);
  } catch {
    return true;
  }
}

export const idbGetAll = async (): Promise<unknown[]> => ((await dbExists()) ? withStore("readonly", (s) => s.getAll()) : []);
export const idbGet = async (id: string): Promise<unknown> => ((await dbExists()) ? withStore("readonly", (s) => s.get(id)) : undefined);
export const idbPut = (value: { id: string }): Promise<IDBValidKey> => withStore("readwrite", (s) => s.put(value));
export const idbDelete = async (id: string): Promise<undefined> => ((await dbExists()) ? withStore("readwrite", (s) => s.delete(id)) : undefined);

/** Deletes the whole database (sign-out, "Remove all"). Resolves even when it was blocked or missing. */
export function idbDeleteDatabase(): Promise<void> {
  if (!idbAvailable()) return Promise.resolve();
  deleting = true;
  const current = opening;
  opening = null;
  return (current ? current.then((db) => db.close()).catch(() => undefined) : Promise.resolve())
    .then(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(OFFLINE_DB);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          // Another tab still has it open: it closes on "versionchange" and the deletion completes then.
          req.onblocked = () => resolve();
        }),
    )
    .finally(() => {
      deleting = false;
    });
}
