import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { 
  verifyPassword, 
  generateToken, 
  generateCsrfToken,
  AUTH_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS 
} from "@/lib/auth";
import {
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  checkRateLimit, 
  getClientIp, 
  loginRateLimit, 
  rateLimitResponse 
} from "@/lib/rate-limit";
import { 
  loginSchema, 
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

/**
 * POST /api/auth/login
 * User login - Sets httpOnly cookie for auth token
 * Rate limited: 5 attempts per 15 minutes
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, loginRateLimit);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(loginSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { email, password } = validation.data;

    // Find user by email
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return errorResponse("Invalid credentials", 401);
    }

    const user = result.rows[0];

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse("Invalid credentials", 401);
    }

    // Generate tokens
    const token = generateToken(user);
    const csrfToken = generateCsrfToken(user.id);

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_host: user.is_host,
        },
        csrfToken, // Send CSRF token in response body
      },
    });

    // Set httpOnly cookie for auth token (not accessible by JavaScript)
    response.cookies.set(AUTH_COOKIE_OPTIONS.name, token, {
      httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
      secure: AUTH_COOKIE_OPTIONS.secure,
      sameSite: AUTH_COOKIE_OPTIONS.sameSite,
      path: AUTH_COOKIE_OPTIONS.path,
      maxAge: AUTH_COOKIE_OPTIONS.maxAge,
    });

    // Set CSRF token cookie (readable by JavaScript for inclusion in requests)
    response.cookies.set(CSRF_COOKIE_OPTIONS.name, csrfToken, {
      httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
      secure: CSRF_COOKIE_OPTIONS.secure,
      sameSite: CSRF_COOKIE_OPTIONS.sameSite,
      path: CSRF_COOKIE_OPTIONS.path,
      maxAge: CSRF_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return serverErrorResponse(error);
  }
}
