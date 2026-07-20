import NextAuth from "next-auth";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe NextAuth instance (no Prisma / bcrypt imported here).
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/auth/signin", "/auth/signup", "/auth/error", "/about"];

function isPublicPath(pathname: string): boolean {
  // NOTE: the landing page "/" must be matched EXACTLY — using startsWith("/")
  // would match every path and disable auth protection for the whole app.
  return (
    pathname === "/" ||
    PUBLIC_PREFIXES.some((route) => pathname === route || pathname.startsWith(route + "/"))
  );
}

const authMiddleware = auth((req) => {
  const session = req.auth;
  const pathname = req.nextUrl.pathname;
  const isPublicRoute = isPublicPath(pathname);

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

/**
 * Wrap the NextAuth middleware so that ANY failure while resolving the session
 * (e.g. a missing NEXTAUTH_SECRET/AUTH_SECRET in production, or a token decode
 * error) does NOT crash the entire site with a 500 (MIDDLEWARE_INVOCATION_FAILED).
 * Instead we fail safe: public pages still load, and protected pages redirect to
 * sign-in. The app stays up; the fix is still to set the secret in the env.
 */
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  try {
    return await authMiddleware(req, event);
  } catch (error) {
    console.error("Middleware auth error (failing safe):", error);
    const pathname = req.nextUrl.pathname;
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }
}

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
