import { trustedMutation } from "@/lib/security/same-origin";
import { reserveLimits } from "@/lib/security/rate-limit";
import { clientAddress } from "@/lib/security/rate-policy";
import { accountMailConfigured, verificationRequired } from "@/lib/account/mail";
import { issueAccountLink } from "@/lib/account/recovery";
import { passwordProblem } from "@/lib/account/password-rules";
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { USERNAME_TEXT, normalizeUsername, usernameProblem } from "@/lib/account/username-rules";
import { isUniqueViolationOn } from "@/lib/account/username";

const USERNAME_TAKEN = "This username is already taken — choose another.";

export const dynamic = "force-dynamic";

/**
 * Map low-level database/Prisma failures to clear, actionable messages.
 * The Prisma error `code` is safe to surface (it is not sensitive) and
 * pinpoints setup problems — e.g. missing tables or an unreachable DB —
 * which are the most common causes of a signup "Internal server error".
 */
function describeDbError(error: unknown): { message: string; code?: string } | null {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;

  // Prisma client could not initialise (missing/invalid DATABASE_URL, etc.)
  if (name === "PrismaClientInitializationError") {
    return {
      message:
        "The server cannot connect to the database. Please check the DATABASE_URL configuration.",
      code: "DB_INIT",
    };
  }

  switch (code) {
    case "P1000": // authentication failed
    case "P1001": // can't reach database server
    case "P1002": // connection timed out
      return {
        message: "The database is currently unreachable. Please try again shortly.",
        code,
      };
    case "P2021": // table does not exist
    case "P2022": // column does not exist
      return {
        message:
          "The database has not been initialised. Run the schema migration (npm run db:push) and try again.",
        code,
      };
    case "P2002": // unique constraint failed (email or username already taken)
      return isUniqueViolationOn(error, "username")
        ? { message: USERNAME_TAKEN, code: "username_taken" }
        : { message: "An account with this email already exists.", code };
    default:
      return code ? { message: "A database error occurred. Please try again.", code } : null;
  }
}

export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  try {
    if (verificationRequired() && !accountMailConfigured()) return NextResponse.json({ error: "Registration email is not configured. Contact Averna support." }, { status: 503 });
    const limit = await reserveLimits([{ key: `signup:${clientAddress(req.headers)}`, limit: 5, seconds: 3600 }]);
    if (!limit.ok) return NextResponse.json({ error: "Please wait before creating another account." }, { status: limit.unavailable ? 503 : 429 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const personalGoal = typeof body.personalGoal === "string" ? body.personalGoal.trim() : "";

    // Validation
    if (!name || !email || !username || !password || !personalGoal) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const usernameIssue = usernameProblem(username);
    if (usernameIssue) {
      return NextResponse.json(
        { error: `Username: ${USERNAME_TEXT.en[usernameIssue]}`, code: "username_invalid" },
        { status: 400 }
      );
    }

    if (name.length > 100 || email.length > 254 || personalGoal.length > 200 || passwordProblem(password, { email, username })) {
      return NextResponse.json(
        { error: "Use 8+ characters, a letter and a number; avoid common passwords (maximum 72 bytes)." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Every username belongs to one account.
    const usernameOwner = await db.user.findUnique({ where: { username }, select: { id: true } });
    if (usernameOwner) {
      return NextResponse.json({ error: USERNAME_TAKEN, code: "username_taken" }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create the user and their student profile atomically. Without a
    // transaction, a failure while creating the Student would leave an
    // orphaned User row — permanently blocking re-registration with a
    // confusing "email already exists" error.
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          username,
          password: hashedPassword,
          role: "STUDENT",
          emailVerified: null,
        },
      });

      await tx.student.create({
        data: {
          userId: created.id,
          personalGoal,
        },
      });

      return created;
    });

    let verificationSent = false;
    if (accountMailConfigured()) {
      try { await issueAccountLink(user, "verify"); verificationSent = true; } catch { console.error("Signup verification email delivery failed"); }
    }
    return NextResponse.json(
      {
        verificationRequired: verificationRequired(),
        verificationSent,
        message: verificationRequired() ? "Account created. Confirm your email before signing in; you can request a new link on the sign-in page." : "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);

    const described = describeDbError(error);
    if (described) {
      // A unique-constraint race means the email was taken between our check
      // and the insert — treat as a conflict, not a server error.
      const status = described.code === "P2002" || described.code === "username_taken" ? 409 : 503;
      return NextResponse.json(
        { error: described.message, code: described.code },
        { status }
      );
    }

    const detail =
      process.env.NODE_ENV === "production"
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error);

    return NextResponse.json(
      { error: "Internal server error", detail },
      { status: 500 }
    );
  }
}
