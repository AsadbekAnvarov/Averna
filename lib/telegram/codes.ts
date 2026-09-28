/**
 * One-time link codes for Telegram deep links (https://t.me/<bot>?start=<code>).
 *
 *   - 24 random bytes (192 bits) as base64url → exactly 32 characters of
 *     A–Z a–z 0–9 _ -, the alphabet Telegram allows in a start parameter (≤ 64);
 *   - stored as a SHA-256 hash (TelegramLinkCode.code), so a leaked table can't
 *     be replayed — the raw code only ever lives in the link itself;
 *   - single use and short-lived: user codes 15 minutes, parent invites 7 days.
 *
 * SERVER ONLY (node crypto).
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const USER_CODE_TTL_MS = 15 * 60 * 1000;
export const PARENT_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CODE_LENGTH = 32;
const CODE_BYTES = 24;
const CODE_RE = /^[A-Za-z0-9_-]{32}$/;

export function newLinkCode(): string {
  return randomBytes(CODE_BYTES).toString("base64url");
}

export function isLinkCode(s: unknown): s is string {
  return typeof s === "string" && CODE_RE.test(s);
}

/** What TelegramLinkCode.code stores. */
export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function deepLink(botUsername: string, code: string): string {
  return `https://t.me/${encodeURIComponent(botUsername)}?start=${code}`;
}

/** Constant-time string comparison (both sides hashed first, so lengths may differ). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}
