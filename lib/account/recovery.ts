import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { passwordProblem } from "./password-rules";
import { markPasswordChanged, passwordStamp } from "./session-guard";
import {
  newAccountToken,
  tokenHash,
  validRawToken,
  type TokenPurpose,
} from "./tokens";
import { sendAccountMail } from "./mail";

export async function issueAccountLink(
  user: { id: string; email: string },
  purpose: TokenPurpose,
) {
  const minted = newAccountToken(purpose);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id} FOR UPDATE`;
    await tx.accountToken.deleteMany({ where: { userId: user.id, purpose } });
    await tx.accountToken.create({
      data: {
        tokenHash: minted.tokenHash,
        userId: user.id,
        email: user.email,
        purpose,
        expiresAt: minted.expiresAt,
      },
    });
  });
  try {
    await sendAccountMail(user.email, purpose, minted.token);
  } catch (e) {
    await db.accountToken.deleteMany({
      where: { tokenHash: minted.tokenHash },
    });
    throw e;
  }
}
export async function consumeAccountLink(
  raw: unknown,
  purpose: TokenPurpose,
  password?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!validRawToken(raw))
    return {
      ok: false,
      error: "This link is invalid or expired. Request a new one.",
    };
  const digest = tokenHash(raw);
  const early = await db.accountToken.findUnique({
    where: { tokenHash: digest },
    include: { user: true },
  });
  if (
    !early ||
    early.purpose !== purpose ||
    early.expiresAt.getTime() <= Date.now() ||
    early.email !== early.user.email
  )
    return {
      ok: false,
      error: "This link is invalid or expired. Request a new one.",
    };
  let nextHash: string | undefined;
  if (purpose === "reset") {
    if (
      typeof password !== "string" ||
      passwordProblem(password, {
        email: early.user.email,
        username: early.user.username,
      })
    )
      return {
        ok: false,
        error:
          "Use 8+ characters, a letter and a number; avoid common passwords. Maximum 72 bytes.",
      };
    nextHash = await hash(password, 12);
  }
  const changed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${early.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: early.userId } });
    if (!user || user.email !== early.email) return null;
    const used = await tx.accountToken.deleteMany({
      where: { tokenHash: digest, purpose, expiresAt: { gt: new Date() } },
    });
    if (used.count !== 1) return null; // one use, even for concurrent submits
    const at = new Date(
      Math.max(Date.now(), passwordStamp(user.passwordChangedAt) + 1),
    );
    await tx.user.update({
      where: { id: user.id },
      data:
        purpose === "verify"
          ? { emailVerified: at }
          : { password: nextHash, passwordChangedAt: at },
    });
    if (purpose === "reset")
      await tx.accountToken.deleteMany({
        where: { userId: user.id, purpose: "reset" },
      });
    return { userId: user.id, at };
  });
  if (!changed)
    return {
      ok: false,
      error: "This link was already used or expired. Request a new one.",
    };
  if (purpose === "reset") markPasswordChanged(changed.userId, changed.at);
  return { ok: true };
}
