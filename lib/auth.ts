import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";

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
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Normalise the email the same way signup does so that logins are
        // case/whitespace-insensitive and always match the stored record.
        const email = (credentials.email as string).trim().toLowerCase();

        const user = await db.user.findUnique({
          where: {
            email,
          },
        });

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
