import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Paths exempt from CSRF validation (unauthenticated endpoints)
const csrfExemptPaths = [
  "/api/auth/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Paths that require host/admin role
const adminPaths = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public path
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Get token from httpOnly cookie (primary) or Authorization header (fallback)
  const cookieToken = request.cookies.get("auth_token")?.value;
  const headerToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const token = cookieToken || headerToken;

  // If accessing a public path and has token, redirect to dashboard
  if (isPublicPath && token && pathname !== "/api/auth/login" && pathname !== "/api/auth/logout") {
    // Don't redirect API routes
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // If accessing a protected path without token, redirect to login
  if (!isPublicPath && !token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // For pages, redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // CSRF validation for mutation requests on API routes
  if (pathname.startsWith("/api/") && token) {
    const method = request.method.toUpperCase();
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
    const isCsrfExempt = csrfExemptPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    if (isMutation && !isCsrfExempt) {
      // Get CSRF token from header
      const csrfToken = request.headers.get("x-csrf-token");
      
      if (!csrfToken) {
        return NextResponse.json(
          { success: false, message: "CSRF token required" },
          { status: 403 }
        );
      }
      // Note: Full CSRF validation happens in auth.ts verifyCsrfToken
      // Middleware just ensures the header is present
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - socket.io (WebSocket connections)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|socket\\.io).*)",
  ],
};
