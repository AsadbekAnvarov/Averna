import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration.
 *
 * This file must NOT import anything that depends on Node.js APIs
 * (no Prisma, no bcryptjs). It is used by the Edge middleware to
 * read/verify the JWT session. The actual Credentials provider with
 * database access is added in lib/auth.ts (Node runtime only).
 */
export const authConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  // Providers are added in lib/auth.ts (Node runtime).
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
