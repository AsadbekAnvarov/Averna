/**
 * Offline packs (idea 7): names shared by the page code and the service worker.
 * The worker's copies live in public/sw-routes.js; tests/sw-routes.test.ts checks they agree.
 */

/** Cache Storage: pack files written by the page (interactive lesson HTML, recordings). */
export const OFFLINE_PACKS_CACHE = "averna-offline-packs-v1";
/** Cache Storage: the /offline page HTML and its static files (written by the worker). */
export const OFFLINE_SHELL_CACHE = "averna-offline-shell-v1";
/** IndexedDB database and store holding the packs (one record per pack). */
export const OFFLINE_DB = "averna-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_STORE = "packs";
/** localStorage: the user id the packs on this device belong to. */
export const OFFLINE_OWNER_KEY = "averna_offline_owner";
/** localStorage: grades waiting to be sent (lib/offline/sync-queue.ts). */
export const OFFLINE_QUEUE_KEY = "averna_offline_queue_v1";
/** Fired on window whenever the packs or the queue change (detail: nothing). */
export const OFFLINE_EVENT = "averna-offline";
/** Total cap for everything saved for offline on this device. */
export const OFFLINE_CAP_BYTES = 150 * 1024 * 1024;
/** "Save my due cards": at most this many cards in the snapshot. */
export const DUE_PACK_MAX = 200;
