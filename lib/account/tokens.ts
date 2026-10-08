import { createHash, randomBytes } from "node:crypto";
export type TokenPurpose = "verify" | "reset";
export function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
export function newAccountToken(purpose: TokenPurpose, now = Date.now()) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: tokenHash(token),
    expiresAt: new Date(now + (purpose === "verify" ? 24 * 60 : 30) * 60_000),
  };
}
export function validRawToken(raw: unknown): raw is string {
  return typeof raw === "string" && /^[a-f0-9]{64}$/.test(raw);
}
