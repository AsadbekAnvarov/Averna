import { trustedMutation } from "@/lib/security/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reserveLimits } from "@/lib/security/rate-limit";
import { clientAddress } from "@/lib/security/rate-policy";
import { accountMailConfigured } from "./mail";
import { consumeAccountLink, issueAccountLink } from "./recovery";
import type { TokenPurpose } from "./tokens";
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
export async function requestAccountLink(
  req: NextRequest,
  purpose: TokenPurpose,
) {
  if (!trustedMutation(req))
    return reply({ error: "Untrusted request origin." }, 403);
  try {
    if (!accountMailConfigured())
      return reply(
        {
          error:
            "Email recovery is not configured yet. Contact your Averna administrator.",
        },
        503,
      );
    const body = await req.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return reply({ error: "Enter a valid email address." }, 400);
    const limit = await reserveLimits([
      {
        key: `account-link:${clientAddress(req.headers)}`,
        limit: 15,
        seconds: 3600,
      },
      { key: `account-link:${purpose}:${email}`, limit: 3, seconds: 3600 },
    ]);
    if (!limit.ok)
      return reply(
        { error: "Please wait before requesting another link." },
        limit.unavailable ? 503 : 429,
      );
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });
    if (user && (purpose !== "verify" || !user.emailVerified)) {
      // Same response for unknown accounts, verified accounts, and provider delivery errors.
      try {
        await issueAccountLink(user, purpose);
      } catch {
        console.error("Account link delivery failed");
      }
    }
    return reply({
      message:
        "If an eligible account exists, a single-use link will arrive by email. Check your spam folder too.",
    });
  } catch {
    return reply(
      { error: "Email service is temporarily unavailable. Try again shortly." },
      503,
    );
  }
}
export async function confirmAccountLink(
  req: NextRequest,
  purpose: TokenPurpose,
) {
  if (!trustedMutation(req))
    return reply({ error: "Untrusted request origin." }, 403);
  try {
    const limit = await reserveLimits([
      {
        key: `account-confirm:${clientAddress(req.headers)}`,
        limit: 20,
        seconds: 900,
      },
    ]);
    if (!limit.ok)
      return reply(
        { error: "Please wait and try again." },
        limit.unavailable ? 503 : 429,
      );
    const body = await req.json().catch(() => null);
    const result = await consumeAccountLink(
      body?.token,
      purpose,
      body?.password,
    );
    return reply(result, result.ok ? 200 : 400);
  } catch {
    return reply(
      { error: "This request could not be completed. Try again shortly." },
      503,
    );
  }
}
