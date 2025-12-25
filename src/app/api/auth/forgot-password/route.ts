import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { generateOTP, storeOTP } from "@/lib/otp";
import { sendPasswordResetOTPEmail } from "@/lib/email";
import {
  successResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  checkRateLimit, 
  getClientIp, 
  passwordResetRateLimit, 
  rateLimitResponse 
} from "@/lib/rate-limit";
import { 
  forgotPasswordSchema, 
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

/**
 * POST /api/auth/forgot-password
 * Send OTP for password reset
 * Rate limited: 3 requests per 30 minutes
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, passwordResetRateLimit);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(forgotPasswordSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { email } = validation.data;

    // Check if user exists
    const result = await pool.query(
      "SELECT id, username FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if user exists or not
      return successResponse(
        null,
        "If an account exists with this email, an OTP will be sent"
      );
    }

    const user = result.rows[0];

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Send OTP email
    await sendPasswordResetOTPEmail(email, otp, user.username);

    console.log(`Password reset OTP sent to ${email}: ${otp}`);
    return successResponse(
      null,
      "If an account exists with this email, an OTP will be sent"
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return serverErrorResponse(error);
  }
}
