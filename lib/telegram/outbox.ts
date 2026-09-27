/**
 * Throttled delivery of many Telegram messages — the instant fan-out of
 * notifyUsers and the 19:00 daily job.
 *
 *   - ~25 messages a second per server instance (Telegram allows ~30 to
 *     different chats), shared by every batch running in this process;
 *   - about one message a second to the same chat;
 *   - a few sends in flight at once, each with its own timeout;
 *   - a time budget: once it runs out, the rest is counted as `skipped`;
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
  /** Resolves when the next send may start. */
  acquire(): Promise<void>;
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
    async acquire() {
      const now = clock.now();
      const at = Math.max(now, next);
      next = at + gap;
      if (at > now) await clock.sleep(at - now);
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
  o: { timeoutMs: number; maxRetryWaitMs: number; onRetryAfter: (ms: number) => void }
) => Promise<TgResult<unknown>>;

export interface BatchOptions {
  send?: SendFn;
  limiter?: RateLimiter;
  clock?: Clock;
  /** Per message (default 3 s). */
  timeoutMs?: number;
  /** Longest 429 wait worth retrying (default 3 s). */
  maxRetryWaitMs?: number;
  /** No new send starts after this many ms (default 9 s). */
  budgetMs?: number;
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
  const maxRetryWaitMs = opts.maxRetryWaitMs ?? 3000;
  const deadline = clock.now() + (opts.budgetMs ?? 9000);
  const gone = new Set<string>();
  const chatSlot = new Map<string, number>();
  let index = 0;

  const worker = async () => {
    for (;;) {
      const i = index++;
      if (i >= messages.length) return;
      const m = messages[i];
      if (clock.now() >= deadline || gone.has(m.chatId)) {
        result.skipped++;
        continue;
      }
      const t = clock.now();
      const slot = Math.max(t, chatSlot.get(m.chatId) ?? 0);
      chatSlot.set(m.chatId, slot + PER_CHAT_GAP_MS);
      if (slot > t) await clock.sleep(slot - t);
      await limiter.acquire();
      const left = deadline - clock.now();
      if (left <= 0) {
        result.skipped++;
        continue;
      }
      let r: TgResult<unknown>;
      try {
        r = await send(m, {
          timeoutMs: Math.max(1000, Math.min(timeoutMs, left + 1000)),
          maxRetryWaitMs,
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
