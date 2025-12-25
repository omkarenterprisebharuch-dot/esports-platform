import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_OPTIONS, CSRF_COOKIE_OPTIONS } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clear auth cookies and log user out
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Clear auth token cookie
  response.cookies.set(AUTH_COOKIE_OPTIONS.name, "", {
    httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
    secure: AUTH_COOKIE_OPTIONS.secure,
    sameSite: AUTH_COOKIE_OPTIONS.sameSite,
    path: AUTH_COOKIE_OPTIONS.path,
    maxAge: 0, // Expire immediately
  });

  // Clear CSRF token cookie
  response.cookies.set(CSRF_COOKIE_OPTIONS.name, "", {
    httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
    secure: CSRF_COOKIE_OPTIONS.secure,
    sameSite: CSRF_COOKIE_OPTIONS.sameSite,
    path: CSRF_COOKIE_OPTIONS.path,
    maxAge: 0,
  });

  return response;
}
