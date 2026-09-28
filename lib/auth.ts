import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";
import { sessionStillValid } from "@/lib/account/session-guard";
import { looksLikeEmail, normalizeUsername } from "@/lib/account/username-rules";

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Node side only (the Edge middleware uses authConfig as it is): remember
    // when the user signed in, and end the session once the password has been
    // changed after that, or the account was deleted (lib/account/session-guard).
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) return { ...token, loginAt: Date.now() };
      return (await sessionStillValid(token)) ? token : null;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        // The sign-in field takes an email OR a username (the key stays "email" for older clients).
        email: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        if (!login || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // An email (normalised the same way signup does, so logins are
        // case/whitespace-insensitive) or a username (stored lower case, "@" optional).
        const user = looksLikeEmail(login)
          ? await db.user.findUnique({ where: { email: login.toLowerCase() } })
          : await db.user.findUnique({ where: { username: normalizeUsername(login) } });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
});

// Helper functions for authorization
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(role: UserRole | UserRole[]) {
  const user = await requireAuth();
  const roles = Array.isArray(role) ? role : [role];

  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}

export async function requireStudent() {
  return requireRole("STUDENT");
}

export async function requireTeacher() {
  return requireRole("TEACHER");
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}

export async function requireTeacherOrAdmin() {
  return requireRole(["TEACHER", "ADMIN"]);
}
