import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";
import crypto from "crypto";

// SECURITY: JWT_SECRET must be set in environment - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. This is required for production security.");
}

// CSRF token secret for generating tokens
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");

export interface TokenPayload {
  id: number;
  email: string;
  username: string;
  is_host: boolean;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user: {
  id: number;
  email: string;
  username: string;
  is_host?: boolean;
}): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_host: user.is_host || false,
    },
    JWT_SECRET!,
    { expiresIn: "7d" }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload & TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get current user from cookies (for server components)
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  return verifyToken(token);
}

/**
 * Get user from Authorization header OR httpOnly cookie (for API routes)
 * Priority: Cookie (secure) > Header (for backwards compatibility during migration)
 */
export function getUserFromRequest(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): TokenPayload | null {
  // First try httpOnly cookie (preferred, secure method)
  const cookieToken = request.cookies.get("auth_token")?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  // Fallback to Authorization header (backwards compatibility)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return verifyToken(token);
  }

  return null;
}

/**
 * Get user from Authorization header (for API routes)
 * @deprecated Use getUserFromRequest instead for httpOnly cookie support
 */
export function getUserFromHeader(
  authHeader: string | null
): TokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}

// ============ CSRF Protection ============

/**
 * Generate a CSRF token for a user session
 */
export function generateCsrfToken(userId: number): string {
  const timestamp = Date.now();
  const data = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(data)
    .digest("hex");
  return Buffer.from(`${data}:${signature}`).toString("base64");
}

/**
 * Verify a CSRF token
 * Token is valid for 24 hours
 */
export function verifyCsrfToken(token: string, userId: number): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [tokenUserId, timestamp, signature] = decoded.split(":");
    
    // Check user ID matches
    if (parseInt(tokenUserId) !== userId) {
      return false;
    }

    // Check token age (24 hours max)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", CSRF_SECRET)
      .update(`${tokenUserId}:${timestamp}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Cookie configuration for auth token
 */
export const AUTH_COOKIE_OPTIONS = {
  name: "auth_token",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

/**
 * Cookie configuration for CSRF token (readable by JS)
 */
export const CSRF_COOKIE_OPTIONS = {
  name: "csrf_token",
  httpOnly: false, // Must be readable by JavaScript
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60, // 24 hours in seconds
};
