import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight diagnostic endpoint. Reports ONLY booleans / non-sensitive values
 * (never the secret value itself) so you can verify, from the actual running
 * deployment, whether the critical environment variables are present — and
 * WHICH deployment/commit is actually serving the domain.
 *
 * Open: https://<your-domain>/api/health
 * (Safe to delete this file once the deployment is confirmed healthy.)
 */
export async function GET() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  const hasAuthSecret = secret.length > 0;

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

  // Names ONLY (never values) of auth-related env vars — reveals typos / what
  // the runtime actually sees.
  const authEnvKeys = Object.keys(process.env)
    .filter((k) => /AUTH|SECRET/i.test(k))
    .sort();

  const res = NextResponse.json({
    ok: hasAuthSecret && hasDatabaseUrl,
    // Which build is actually serving this domain right now:
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    hasAuthSecret,
    authSecretLength: secret.length, // length only, not the value
    hasDatabaseUrl,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
    authEnvKeys, // e.g. ["NEXTAUTH_SECRET","NEXTAUTH_URL"] — names only
  });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
