import { NextRequest } from "next/server";
import { queryOne, query } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/auth";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";

// Schema for push subscription
const subscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  p256dh_key: z.string().min(1, "p256dh key is required"),
  auth_key: z.string().min(1, "auth key is required"),
  device_type: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
});

interface PushSubscription {
  id: string;
  user_id: number;
  endpoint: string;
}

/**
 * POST /api/notifications/subscribe
 * Save a push subscription to the database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(subscribeSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { endpoint, p256dh_key, auth_key, device_type, browser, os } = validation.data;

    // Check if subscription already exists
    const existing = await queryOne<PushSubscription>(
      `SELECT id FROM push_subscriptions WHERE endpoint = $1`,
      [endpoint]
    );

    if (existing) {
      // Update existing subscription
      await query(
        `UPDATE push_subscriptions
         SET user_id = $1, p256dh_key = $2, auth_key = $3,
             device_type = $4, browser = $5, os = $6,
             is_active = TRUE, last_used_at = NOW()
         WHERE endpoint = $7`,
        [user.id, p256dh_key, auth_key, device_type, browser, os, endpoint]
      );

      return successResponse({ message: "Subscription updated" });
    }

    // Create new subscription
    await query(
      `INSERT INTO push_subscriptions
       (user_id, endpoint, p256dh_key, auth_key, device_type, browser, os)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, endpoint, p256dh_key, auth_key, device_type, browser, os]
    );

    return successResponse({ message: "Subscription saved" });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to save subscription: ${errorMessage}`, 500);
  }
}

/**
 * GET /api/notifications/subscribe
 * Check if user has active subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    const subscriptions = await query<PushSubscription>(
      `SELECT id, device_type, browser, os, subscribed_at, last_used_at
       FROM push_subscriptions
       WHERE user_id = $1 AND is_active = TRUE`,
      [user.id]
    );

    return successResponse({
      hasSubscriptions: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      subscriptions,
    });
  } catch (error) {
    console.error("Error checking subscriptions:", error);
    return errorResponse("Failed to check subscriptions", 500);
  }
}
