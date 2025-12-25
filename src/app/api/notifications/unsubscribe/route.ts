import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/auth";

/**
 * POST /api/notifications/unsubscribe
 * Remove a push subscription from the database
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return errorResponse("Endpoint is required", 400);
    }

    // Mark subscription as inactive (soft delete)
    await query(
      `UPDATE push_subscriptions
       SET is_active = FALSE
       WHERE endpoint = $1 AND user_id = $2`,
      [endpoint, user.id]
    );

    return successResponse({ message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("Error unsubscribing:", error);
    return errorResponse("Failed to unsubscribe", 500);
  }
}
