/**
 * Storage bridge between an interactive lesson (sandboxed, opaque-origin frame) and
 * the app page that hosts it. The lesson's own code keeps calling localStorage; the
 * shim in the frame (lib/articles/lesson-document.ts) turns those calls into messages,
 * and the host keeps the values in the app's localStorage under a per-student prefix.
 *
 * Pure helpers, shared by components/articles/interactive-lesson.tsx and the tests.
 * Client-safe: no lesson HTML or server code here.
 */
export const LESSON_NS = "averna-lesson";
/** Sandbox tokens for the frame and the document's CSP. NEVER allow-same-origin. */
export const LESSON_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals";
export const LESSON_KEY_PATTERN = /^[\w.:-]{1,120}$/;
export const LESSON_VALUE_MAX = 100_000;

export type LessonTheme = "light" | "dark";
export type LessonWrite =
  | { type: "set"; key: string; value: string }
  | { type: "remove"; key: string }
  | { type: "clear" };
export type LessonMessage = { type: "hello" } | { type: "ready" } | LessonWrite;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** `averna_lesson:{userId}:` — the id is URI-encoded, so it never contains ":" and one student's prefix can't match another's. */
export function lessonStoragePrefix(userId: string) {
  return `averna_lesson:${encodeURIComponent(userId)}:`;
}

function isKey(key: unknown): key is string {
  return typeof key === "string" && LESSON_KEY_PATTERN.test(key);
}
function isValue(value: unknown): value is string {
  return typeof value === "string" && value.length <= LESSON_VALUE_MAX;
}

/** The message if it is a well-formed lesson message, otherwise null. */
export function parseLessonMessage(data: unknown): LessonMessage | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.ns !== LESSON_NS) return null;
  switch (d.type) {
    case "hello":
    case "ready":
    case "clear":
      return { type: d.type };
    case "remove":
      return isKey(d.key) ? { type: "remove", key: d.key } : null;
    case "set":
      return isKey(d.key) && isValue(d.value) ? { type: "set", key: d.key, value: d.value } : null;
    default:
      return null;
  }
}

/**
 * Only messages from this lesson's frame: the sender is the frame's window, its origin
 * is opaque ("null", the sandbox works) and the payload is a valid lesson message.
 */
export function isAllowedLessonMessage(
  event: Pick<MessageEvent, "source" | "origin" | "data">,
  frameWindow: Window | null | undefined,
): boolean {
  return !!frameWindow && event.source === frameWindow && event.origin === "null" && parseLessonMessage(event.data) !== null;
}

function keysWithPrefix(storage: StorageLike, prefix: string) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** This student's lesson values (key without the prefix → value), valid entries only. */
export function readLessonItems(storage: StorageLike, userId: string): Record<string, string> {
  const prefix = lessonStoragePrefix(userId);
  const items: Record<string, string> = {};
  try {
    for (const full of keysWithPrefix(storage, prefix)) {
      const key = full.slice(prefix.length);
      const value = storage.getItem(full);
      if (isKey(key) && isValue(value)) items[key] = value;
    }
  } catch {
    // Storage unavailable: the lesson starts fresh.
  }
  return items;
}

/** Applies a lesson write to this student's values. False if it was invalid or storage failed (e.g. quota). */
export function applyLessonWrite(storage: StorageLike, userId: string, write: LessonWrite): boolean {
  const prefix = lessonStoragePrefix(userId);
  try {
    if (write.type === "set") {
      if (!isKey(write.key) || !isValue(write.value)) return false;
      storage.setItem(prefix + write.key, write.value);
    } else if (write.type === "remove") {
      if (!isKey(write.key)) return false;
      storage.removeItem(prefix + write.key);
    } else if (write.type === "clear") {
      for (const key of keysWithPrefix(storage, prefix)) storage.removeItem(key);
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
