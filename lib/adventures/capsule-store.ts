export const CAPSULE_LIMIT = 8;
export const CAPSULE_MAX_BYTES = 4 * 1024 * 1024;
export interface Capsule { id: string; promptId: string; createdAt: string; seconds: number; note: string; audio: Blob; }
function open(owner: string): Promise<IDBDatabase> {
  if (!owner || owner.length > 150 || typeof indexedDB === "undefined") return Promise.reject(new Error("Private device audio storage is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    let rejected = false;
    const request = indexedDB.open(`averna_voice_capsules_v1:${encodeURIComponent(owner)}`, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("recordings")) request.result.createObjectStore("recordings", { keyPath: "id" }); };
    request.onsuccess = () => { const database = request.result; if (rejected) { database.close(); return; } database.onversionchange = () => database.close(); resolve(database); };
    request.onerror = () => reject(new Error("Device audio storage could not be opened. You can still export your preview."));
    request.onblocked = () => { rejected = true; reject(new Error("Close other capsule tabs and try again.")); };
  });
}
function valid(item: Capsule) { return typeof item.id === "string" && typeof item.promptId === "string" && Number.isFinite(Date.parse(item.createdAt)) && Number.isFinite(item.seconds) && item.seconds >= 1 && item.seconds <= 121 && typeof item.note === "string" && item.note.length <= 300 && item.audio instanceof Blob && item.audio.size > 0 && item.audio.size <= CAPSULE_MAX_BYTES && /^audio\//i.test(item.audio.type); }
export async function listCapsules(owner: string): Promise<Capsule[]> {
  const database = await open(owner);
  return new Promise((resolve, reject) => {
    const tx = database.transaction("recordings", "readonly"); const request = tx.objectStore("recordings").getAll();
    let items: Capsule[] = [];
    request.onsuccess = () => { items = request.result.filter(valid).sort((a: Capsule, b: Capsule) => b.createdAt.localeCompare(a.createdAt)).slice(0, CAPSULE_LIMIT); };
    tx.oncomplete = () => { database.close(); resolve(items); }; tx.onabort = tx.onerror = () => { database.close(); reject(new Error("Saved recordings could not be loaded.")); };
  });
}
export async function saveCapsule(owner: string, item: Capsule) {
  if (!valid(item)) throw new Error("The recording is empty, too large or unsupported. It was not saved.");
  const database = await open(owner);
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("recordings", "readwrite"); const store = tx.objectStore("recordings"); const count = store.count(); let reason = "Device storage is full or unavailable. Export your preview before leaving.";
    count.onsuccess = () => { if (count.result >= CAPSULE_LIMIT) { reason = `Keep at most ${CAPSULE_LIMIT} recordings. Export or delete one before saving a new capsule.`; tx.abort(); } else store.add(item); };
    tx.oncomplete = () => { database.close(); resolve(); }; tx.onabort = tx.onerror = () => { database.close(); reject(new Error(reason)); };
  });
}
export async function deleteCapsule(owner: string, id: string) {
  const database = await open(owner);
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("recordings", "readwrite"); tx.objectStore("recordings").delete(id);
    tx.oncomplete = () => { database.close(); resolve(); }; tx.onabort = tx.onerror = () => { database.close(); reject(new Error("The recording could not be deleted. Try again.")); };
  });
}
