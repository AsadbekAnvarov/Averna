import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyLessonWrite,
  isAllowedLessonMessage,
  LESSON_KEY_PATTERN,
  LESSON_NS,
  LESSON_VALUE_MAX,
  lessonStoragePrefix,
  parseLessonMessage,
  readLessonItems,
} from "@/lib/articles/lesson-bridge";

/** A real Storage-like map (same contract as window.localStorage). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(String(k), String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const validKey = fc.stringMatching(/^[\w.:-]{1,40}$/);
const anyKey = fc.oneof(validKey, fc.string({ maxLength: 130 }), fc.constant(""), fc.constant("a".repeat(121)), fc.constant("bad key"));
const anyValue = fc.oneof(fc.string({ maxLength: 50 }), fc.constant("x".repeat(LESSON_VALUE_MAX + 1)), fc.integer(), fc.constant(null));
const userId = fc.oneof(fc.constantFrom("u1", "u2", "clx0abc"), fc.string({ minLength: 1, maxLength: 12 }));

describe("lesson storage bridge", () => {
  /** **Validates: bridge requirement — only allowed writes are stored, under the per-student prefix** */
  it("stores only valid keys/values, under averna_lesson:<userId>:", () => {
    fc.assert(
      fc.property(userId, fc.array(fc.record({ key: anyKey, value: anyValue }), { maxLength: 30 }), (user, writes) => {
        const storage = memoryStorage();
        const expected = new Map<string, string>();
        for (const { key, value } of writes) {
          const message = parseLessonMessage({ ns: LESSON_NS, type: "set", key, value });
          const valid = typeof key === "string" && LESSON_KEY_PATTERN.test(key) && typeof value === "string" && value.length <= LESSON_VALUE_MAX;
          expect(message !== null).toBe(valid);
          if (message && message.type === "set") {
            expect(applyLessonWrite(storage, user, message)).toBe(true);
            expected.set(key as string, value as string);
          }
        }
        const prefix = lessonStoragePrefix(user);
        expect(storage.length).toBe(expected.size);
        for (let i = 0; i < storage.length; i++) expect(storage.key(i)!.startsWith(prefix)).toBe(true);
        expect(readLessonItems(storage, user)).toEqual(Object.fromEntries(expected));
      }),
    );
  });

  /** **Validates: bridge requirement — a student reads back exactly their own values** */
  it("reads back exactly what was stored for that student, never another student's", () => {
    fc.assert(
      fc.property(
        userId,
        userId,
        fc.dictionary(validKey, fc.string({ maxLength: 20 }), { maxKeys: 10 }),
        fc.dictionary(validKey, fc.string({ maxLength: 20 }), { maxKeys: 10 }),
        (a, b, itemsA, itemsB) => {
          fc.pre(a !== b);
          const storage = memoryStorage();
          storage.setItem("averna_theme", "dark"); // app keys are not lesson keys
          for (const [key, value] of Object.entries(itemsA)) applyLessonWrite(storage, a, { type: "set", key, value });
          for (const [key, value] of Object.entries(itemsB)) applyLessonWrite(storage, b, { type: "set", key, value });
          expect(readLessonItems(storage, a)).toEqual(itemsA);
          expect(readLessonItems(storage, b)).toEqual(itemsB);
          applyLessonWrite(storage, a, { type: "clear" });
          expect(readLessonItems(storage, a)).toEqual({});
          expect(readLessonItems(storage, b)).toEqual(itemsB);
          expect(storage.getItem("averna_theme")).toBe("dark");
        },
      ),
    );
  });

  it("removes single keys and ignores invalid or oversize writes", () => {
    const storage = memoryStorage();
    expect(applyLessonWrite(storage, "u1", { type: "set", key: "efvocab-v1-food", value: "{}" })).toBe(true);
    expect(applyLessonWrite(storage, "u1", { type: "set", key: "efvocab-v1-food-draft", value: "My text" })).toBe(true);
    expect(applyLessonWrite(storage, "u1", { type: "remove", key: "efvocab-v1-food" })).toBe(true);
    expect(applyLessonWrite(storage, "u1", { type: "set", key: "bad key", value: "x" })).toBe(false);
    expect(applyLessonWrite(storage, "u1", { type: "set", key: "big", value: "x".repeat(LESSON_VALUE_MAX + 1) })).toBe(false);
    expect(readLessonItems(storage, "u1")).toEqual({ "efvocab-v1-food-draft": "My text" });
    expect(storage.getItem("averna_lesson:u1:efvocab-v1-food-draft")).toBe("My text");
    const full = { ...memoryStorage(), length: 0, key: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(applyLessonWrite(full, "u1", { type: "set", key: "k", value: "v" })).toBe(false);
  });

  it("accepts messages only from the lesson frame's opaque origin", () => {
    const frame = {} as Window;
    const data = { ns: LESSON_NS, type: "hello" };
    expect(isAllowedLessonMessage({ source: frame, origin: "null", data }, frame)).toBe(true);
    expect(isAllowedLessonMessage({ source: {} as Window, origin: "null", data }, frame)).toBe(false);
    expect(isAllowedLessonMessage({ source: frame, origin: "http://localhost:3000", data }, frame)).toBe(false);
    expect(isAllowedLessonMessage({ source: frame, origin: "null", data: { ...data, ns: "other" } }, frame)).toBe(false);
    expect(isAllowedLessonMessage({ source: frame, origin: "null", data: { ns: LESSON_NS, type: "state" } }, frame)).toBe(false);
    expect(isAllowedLessonMessage({ source: null, origin: "null", data }, null)).toBe(false);
    expect(parseLessonMessage("hello")).toBeNull();
  });
});
