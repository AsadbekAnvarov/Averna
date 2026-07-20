import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe NextAuth instance (no Prisma / bcrypt imported here).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const pathname = req.nextUrl.pathname;

  // Public routes that don't require authentication.
  // NOTE: the landing page "/" must be matched EXACTLY — using startsWith("/")
  // would match every path and disable auth protection for the whole app.
  const publicPrefixes = ["/auth/signin", "/auth/signup", "/auth/error", "/about"];
  const isPublicRoute =
    pathname === "/" ||
    publicPrefixes.some((route) => pathname === route || pathname.startsWith(route + "/"));

  // If user is not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If user is authenticated and trying to access auth pages
  if (session && (pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup"))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Role-based route protection
  if (session) {
    const userRole = session.user.role;

    // Teacher routes
    if (pathname.startsWith("/teacher") && userRole !== "TEACHER" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), req.url));
    }

    // Admin routes
    if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), req.url));
    }
  }

  return NextResponse.next();
});

function getRoleDefaultRoute(role: string): string {
  switch (role) {
    case "STUDENT":
      return "/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    default:
      return "/";
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
