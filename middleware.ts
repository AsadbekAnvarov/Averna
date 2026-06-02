import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/signin", "/auth/signup", "/auth/error", "/about"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If user is authenticated and trying to access auth pages
  if (session && (pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Role-based route protection
  if (session) {
    const userRole = session.user.role;

    // Student routes
    if (pathname.startsWith("/dashboard") && userRole !== "STUDENT") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), request.url));
    }

    // Teacher routes
    if (pathname.startsWith("/teacher") && userRole !== "TEACHER" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), request.url));
    }

    // Admin routes
    if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), request.url));
    }

    // Redirect from base /dashboard to role-specific dashboard
    if (pathname === "/dashboard") {
      return NextResponse.redirect(new URL(getRoleDefaultRoute(userRole), request.url));
    }
  }

  return NextResponse.next();
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
