import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight diagnostic endpoint. Reports ONLY booleans / non-sensitive values
 * (never the secret itself) so you can verify, from the actual running
 * deployment, whether the critical environment variables are present.
 *
 * Open: https://<your-domain>/api/health
 */
export async function GET() {
  const hasAuthSecret = !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET);

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    "";
  const hasDatabaseUrl =
    dbUrl.length > 0 && !dbUrl.includes("localhost") && !dbUrl.includes("placeholder");

  return NextResponse.json({
    ok: hasAuthSecret && hasDatabaseUrl,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null, // "production" | "preview" | "development"
    hasAuthSecret,
    hasDatabaseUrl,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL ?? null, // safe to show — it's just the public URL
  });
}
