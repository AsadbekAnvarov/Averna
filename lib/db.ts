import { PrismaClient } from "@prisma/client";

/**
 * Resolve the Postgres connection string from the various environment
 * variable names that Vercel / Neon integrations may use.
 * Placeholder / localhost values are ignored so a stray .env value can
 * never override the real production database.
 */
function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.NEON_DATABASE_URL,
  ];

  return candidates.find(
    (url) =>
      !!url &&
      url.length > 0 &&
      !url.includes("localhost") &&
      !url.includes("placeholder")
  );
}

const databaseUrl = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
