/**
 * Throttled delivery of many Telegram messages — the fan-out of notifyUsers
 * and the evening daily job.
 *
 *   - ~25 messages a second per server instance (Telegram allows ~30 to
 *     different chats), shared by every batch running in this process;
 *   - about one message a second to the same chat;
 *   - a few sends in flight at once, each with its own timeout;
 *   - a deadline (a time budget, or a shared getter for parallel batches):
 *     no send starts after it, and a 429 wait is only retried when it still
 *     fits before it — the rest is counted as `skipped`;
 *   - chats that turned out blocked / gone are reported through `onGone`.
 *
 * Never throws. The sender is injectable (offline tests use a fake).
 */

import { sendMessage, sleep as realSleep, type TgResult } from "./api";
import { MAX_MESSAGE_CHARS } from "./messages";
import type { Keyboard } from "./types";

export interface Outgoing {
  chatId: string;
  text: string;
  keyboard?: Keyboard;
}

export interface RateLimiter {
  /**
   * Resolves true when the next send may start. With `notAfter`, resolves
   * false at once (reserving nothing) when that slot would come later.
   */
  acquire(notAfter?: number): Promise<boolean>;
  /** Hold every send for `ms` (Telegram answered 429). */
  pause(ms: number): void;
}

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: Clock = { now: () => Date.now(), sleep: realSleep };

export function createRateLimiter(perSecond: number, clock: Clock = realClock): RateLimiter {
  const gap = 1000 / Math.max(1, perSecond);
  let next = 0;
  return {
    async acquire(notAfter?: number) {
      const now = clock.now();
      const at = Math.max(now, next);
      if (notAfter != null && at > notAfter) return false;
      next = at + gap;
      if (at > now) await clock.sleep(at - now);
      return true;
    },
    pause(ms: number) {
      next = Math.max(next, clock.now() + ms);
    },
  };
}

export const TELEGRAM_RATE_PER_SECOND = 25;
const sharedLimiter = createRateLimiter(TELEGRAM_RATE_PER_SECOND);
/** Telegram: avoid more than one message a second to the same chat. */
export const PER_CHAT_GAP_MS = 1100;

export type SendFn = (
  m: Outgoing,
  o: {
    timeoutMs: number;
    retries: number;
    /** Asked when a 429 arrives: the longest wait still worth retrying. */
    maxRetryWaitMs: () => number;
    onRetryAfter: (ms: number) => void;
  }
) => Promise<TgResult<unknown>>;

export interface BatchOptions {
  send?: SendFn;
  limiter?: RateLimiter;
  clock?: Clock;
  /** Per message (default 3 s). */
  timeoutMs?: number;
  /** 429 retries per message (default 1; 0 = a 429 is a failure). */
  retries?: number;
  /** Longest 429 wait worth retrying (default 3 s) — never past the deadline (a message timeout is kept for the retry). */
  maxRetryWaitMs?: number;
  /** No new send starts after this many ms (default 9 s). Ignored when `deadline` is given. */
  budgetMs?: number;
  /** Clock time after which no send starts — a getter, so parallel batches can share one that grows. */
  deadline?: () => number;
  /** Sends in flight (default 5). */
  concurrency?: number;
  onGone?: (chatIds: string[]) => Promise<unknown>;
}

export interface BatchResult {
  sent: number;
  failed: number;
  /** Blocked by the user / chat gone — links marked inactive via onGone. */
  gone: number;
  /** Not attempted: the time budget ran out (or the chat was already gone). */
  skipped: number;
}

const defaultSend: SendFn = (m, o) =>
  sendMessage(m.chatId, m.text, {
    keyboard: m.keyboard,
    timeoutMs: o.timeoutMs,
    retries: o.retries,
    maxRetryWaitMs: o.maxRetryWaitMs,
    onRetryAfter: o.onRetryAfter,
  });

export async function sendBatch(messages: Outgoing[], opts: BatchOptions = {}): Promise<BatchResult> {
  const result: BatchResult = { sent: 0, failed: 0, gone: 0, skipped: 0 };
  if (!messages.length) return result;
  const send = opts.send ?? defaultSend;
  const limiter = opts.limiter ?? sharedLimiter;
  const clock = opts.clock ?? realClock;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const retries = Math.max(0, opts.retries ?? 1);
  const maxRetryWaitMs = opts.maxRetryWaitMs ?? 3000;
  const fixedDeadline = clock.now() + (opts.budgetMs ?? 9000);
  const deadline = opts.deadline ?? (() => fixedDeadline);
  // A 429 wait is retried only if the wait and one more attempt still end by the deadline.
  const retryWaitCap = () => Math.min(maxRetryWaitMs, deadline() - clock.now() - timeoutMs);
  const gone = new Set<string>();
  const chatSlot = new Map<string, number>();
  let index = 0;

  const worker = async () => {
    for (;;) {
      const i = index++;
      if (i >= messages.length) return;
      const m = messages[i];
      const t = clock.now();
      const slot = Math.max(t, chatSlot.get(m.chatId) ?? 0);
      // Past the deadline (or waiting for the chat's turn would be): skip without sleeping.
      if (slot >= deadline() || gone.has(m.chatId)) {
        result.skipped++;
        continue;
      }
      chatSlot.set(m.chatId, slot + PER_CHAT_GAP_MS);
      if (slot > t) await clock.sleep(slot - t);
      if (!(await limiter.acquire(deadline()))) {
        result.skipped++;
        continue;
      }
      const left = deadline() - clock.now();
      if (left <= 0) {
        result.skipped++;
        continue;
      }
      let r: TgResult<unknown>;
      try {
        r = await send(m, {
          timeoutMs: Math.max(1000, Math.min(timeoutMs, left + 1000)),
          retries,
          maxRetryWaitMs: retryWaitCap,
          onRetryAfter: (ms) => limiter.pause(ms),
        });
      } catch (e) {
        r = { ok: false, status: 0, code: null, description: String(e), retryAfter: null, gone: false, network: true };
      }
      if (r.ok) result.sent++;
      else if (r.gone) {
        result.gone++;
        gone.add(m.chatId);
      } else {
        result.failed++;
        console.error(`Telegram send failed (${r.code ?? "network"}): ${r.description}`);
      }
    }
  };

  const n = Math.max(1, Math.min(opts.concurrency ?? 5, messages.length));
  await Promise.all(Array.from({ length: n }, () => worker()));

  if (gone.size && opts.onGone) {
    try {
      await opts.onGone(Array.from(gone));
    } catch (e) {
      console.error("Telegram: marking blocked chats inactive failed:", e);
    }
  }
  return result;
}

/**
 * A shuffled copy (Fisher–Yates). Sends that don't fit the time budget are cut
 * from the end, so the order decides who misses out — shuffling spreads that.
 */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A repeatable random source (mulberry32) seeded by a string — e.g. the day, for an order that changes daily. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERGE_SEPARATOR = "\n\n— — —\n\n";

/**
 * One message per chat where it fits (a parent of two children, a teacher who
 * is also a parent …) — in order of each chat's first message. Texts that
 * don't fit together stay separate (sendBatch spaces them ~1 s apart).
 */
export function mergeByChat(messages: Outgoing[], max = MAX_MESSAGE_CHARS - 96): Outgoing[] {
  const order: string[] = [];
  const byChat = new Map<string, Outgoing[]>();
  for (const m of messages) {
    const list = byChat.get(m.chatId);
    if (list) list.push(m);
    else {
      byChat.set(m.chatId, [m]);
      order.push(m.chatId);
    }
  }
  const out: Outgoing[] = [];
  for (const chatId of order) {
    let cur: Outgoing | null = null;
    for (const m of byChat.get(chatId) ?? []) {
      if (cur && cur.text.length + MERGE_SEPARATOR.length + m.text.length <= max) {
        cur = { chatId, text: cur.text + MERGE_SEPARATOR + m.text, keyboard: cur.keyboard ?? m.keyboard };
      } else {
        if (cur) out.push(cur);
        cur = { ...m };
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}
