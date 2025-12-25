import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { generateOTP, storeOTP } from "@/lib/otp";
import { sendOTPEmail } from "@/lib/email";
import { storePendingRegistration } from "@/lib/pending-registrations";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  checkRateLimit, 
  getClientIp, 
  registerRateLimit,
  otpRateLimit,
  rateLimitResponse 
} from "@/lib/rate-limit";
import { 
  registerSchema, 
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

/**
 * POST /api/auth/send-otp
 * Send OTP for email verification
 * Rate limited: 3 registrations per hour, 3 OTPs per 10 minutes
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    
    // Check registration rate limit (stricter, per hour)
    const registerLimit = checkRateLimit(clientIp, registerRateLimit);
    if (!registerLimit.success) {
      return rateLimitResponse(registerLimit);
    }
    
    // Check OTP rate limit (3 OTPs per 10 min)
    const otpLimit = checkRateLimit(clientIp, otpRateLimit);
    if (!otpLimit.success) {
      return rateLimitResponse(otpLimit);
    }

    const body = await request.json();
    
    // Validate input with Zod (using register schema but we only need username, email, password)
    const validation = validateWithSchema(registerSchema, {
      ...body,
      confirmPassword: body.confirmPassword || body.password, // Allow skipping confirm for OTP flow
    });
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { username, email, password } = validation.data;

    // Check if email already exists
    const existingEmail = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return errorResponse("User with this email already exists");
    }

    // Check if username already exists
    const existingUsername = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existingUsername.rows.length > 0) {
      return errorResponse("Username is already taken");
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Store pending registration data temporarily
    const hashedPassword = await hashPassword(password);
    storePendingRegistration(email, {
      username,
      email,
      hashedPassword,
    });

    // Send OTP email
    await sendOTPEmail(email, otp, username);

    console.log(`OTP sent to ${email}: ${otp}`);
    return successResponse(null, "OTP sent successfully to your email");
  } catch (error) {
    console.error("Send OTP error:", error);
    return serverErrorResponse(error);
  }
}
