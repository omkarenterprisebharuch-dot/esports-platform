/**
 * Rate Limiter for API Routes
 * 
 * In-memory rate limiting with sliding window algorithm.
 * For production at scale, consider using Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (per-IP)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional identifier prefix for different rate limit groups */
  prefix?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { maxRequests, windowSeconds, prefix = "" } = config;
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const entry = rateLimitStore.get(key);

  // No existing entry or entry has expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetIn: windowSeconds,
      limit: maxRequests,
    };
  }

  // Entry exists and is still valid
  if (entry.count >= maxRequests) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetIn,
      limit: maxRequests,
    };
  }

  // Increment the count
  entry.count++;
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetIn,
    limit: maxRequests,
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check various headers for the real IP (when behind proxy/load balancer)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the list (client IP)
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - in production this should be configured properly
  return "unknown";
}

// ============ Pre-configured Rate Limiters ============

/**
 * Strict rate limiter for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimit: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 15 * 60, // 15 minutes
  prefix: "login",
};

/**
 * Rate limiter for registration
 * 3 registrations per hour per IP
 */
export const registerRateLimit: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60 * 60, // 1 hour
  prefix: "register",
};

/**
 * Rate limiter for OTP sending
 * 3 OTPs per 10 minutes per IP
 */
export const otpRateLimit: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 10 * 60, // 10 minutes
  prefix: "otp",
};

/**
 * Rate limiter for password reset
 * 3 requests per 30 minutes per IP
 */
export const passwordResetRateLimit: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 30 * 60, // 30 minutes
  prefix: "password-reset",
};

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const generalApiRateLimit: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60, // 1 minute
  prefix: "api",
};

/**
 * Helper to create a rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      success: false,
      message: `Too many requests. Please try again in ${result.resetIn} seconds.`,
      retryAfter: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": result.resetIn.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetIn.toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", result.resetIn.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
