import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";
import { passwordStamp, sessionStillValid } from "@/lib/account/session-guard";
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
    /** passwordChangedAt (ms, 0 = never) of the row whose password this sign-in verified. */
    pwdAt?: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Node side only (the Edge middleware uses authConfig as it is): the token
    // remembers the passwordChangedAt of the row whose password it verified, and
    // the session ends once that changes, or the account is deleted
    // (lib/account/session-guard).
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) {
        const pwdAt = (params.user as { pwdAt?: unknown }).pwdAt;
        return { ...token, pwdAt: typeof pwdAt === "number" ? pwdAt : 0 };
      }
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
        const select = { id: true, email: true, name: true, role: true, image: true, password: true, passwordChangedAt: true };
        const user = looksLikeEmail(login)
          ? await db.user.findUnique({ where: { email: login.toLowerCase() }, select })
          : await db.user.findUnique({ where: { username: normalizeUsername(login) }, select });

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
          // The password this sign-in verified: the session ends when it changes.
          pwdAt: passwordStamp(user.passwordChangedAt),
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
