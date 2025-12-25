import { NextRequest } from "next/server";
import { getUserFromRequest, verifyCsrfToken } from "./auth";
import { errorResponse } from "./api-response";

/**
 * Validate CSRF token for mutation requests (POST, PUT, DELETE, PATCH)
 * 
 * Usage in API routes:
 * ```
 * const csrfError = validateCsrf(request);
 * if (csrfError) return csrfError;
 * ```
 */
export function validateCsrf(request: NextRequest) {
  const method = request.method.toUpperCase();
  
  // Only validate mutations
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return null;
  }

  // Get user from request
  const user = getUserFromRequest(request);
  if (!user) {
    // No user means unauthorized - let the route handler deal with it
    return null;
  }

  // Get CSRF token from header (preferred) or cookie
  const csrfToken = 
    request.headers.get("x-csrf-token") || 
    request.cookies.get("csrf_token")?.value;

  if (!csrfToken) {
    return errorResponse("CSRF token missing", 403);
  }

  // Verify the token
  if (!verifyCsrfToken(csrfToken, user.id)) {
    return errorResponse("Invalid CSRF token", 403);
  }

  return null; // Valid
}

/**
 * List of paths that are exempt from CSRF validation
 * (typically login, register, and other unauthenticated endpoints)
 */
export const CSRF_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

/**
 * Check if a path is exempt from CSRF validation
 */
export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}
