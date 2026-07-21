import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

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
    case "P2002": // unique constraint failed (email already taken)
      return {
        message: "An account with this email already exists.",
        code,
      };
    default:
      return code ? { message: "A database error occurred. Please try again.", code } : null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const personalGoal = typeof body.personalGoal === "string" ? body.personalGoal.trim() : "";

    // Validation
    if (!name || !email || !password || !personalGoal) {
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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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
          password: hashedPassword,
          role: "STUDENT",
          emailVerified: new Date(),
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

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
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
      const status = described.code === "P2002" ? 409 : 503;
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
